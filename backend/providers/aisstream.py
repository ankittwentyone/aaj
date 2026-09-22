"""AISStream multi-bbox manager — spec §4e + §11.

Rules:
- bboxes ONLY from backend/data/curated/chokepoints.json (code never has coords).
- server-side only, ONE connection, all live bboxes in one BoundingBoxes array.
- FilterMessageTypes=[PositionReport, ShipStaticData], permessage-deflate on.
- exp-backoff+jitter reconnect, resend replaces subscription (<=1 update/sec).
- per-MMSI dedup 220ms, batch diff 500ms-3s (here: in-mem store, flushed to
  SQLite positions_cache every 60s + traffic_hour once/hour per box).
- baseline_7d = AVG(vessel_count) last 7d WHERE chokepoint_id=id; <24 rows ->
  seed average + stale:true.
- start logging Day 1 — real days of data by demo week.
"""
from __future__ import annotations

import asyncio
import json
import pathlib
import random
import sqlite3
import threading
import time
from datetime import datetime, timezone

CURATED = pathlib.Path(__file__).resolve().parents[1] / "data" / "curated" / "chokepoints.json"
DB_PATH = pathlib.Path(__file__).resolve().parents[1] / "data" / "chokepoints.db"
SEED_PATH = pathlib.Path(__file__).resolve().parents[1] / "data" / "seed_baseline.json"

SCHEMA = """
CREATE TABLE IF NOT EXISTS chokepoint(id TEXT PRIMARY KEY, name TEXT, bbox TEXT, live INT);
CREATE TABLE IF NOT EXISTS traffic_hour(
  chokepoint_id TEXT, ts TEXT,
  vessel_count INT, tanker_count INT, cargo_count INT,
  PRIMARY KEY(chokepoint_id, ts));
CREATE TABLE IF NOT EXISTS positions_cache(
  chokepoint_id TEXT, mmsi TEXT, lat REAL, lon REAL, sog REAL, cog REAL, type TEXT, updated_at TEXT,
  PRIMARY KEY(chokepoint_id, mmsi));
CREATE TABLE IF NOT EXISTS crossing_hour(
  chokepoint_id TEXT, ts TEXT, direction TEXT, crossings INT,
  PRIMARY KEY(chokepoint_id, ts, direction));
"""

_lock = threading.Lock()
_positions: dict[str, dict[str, dict]] = {}   # box -> mmsi -> pos
_trails: dict[str, list] = {}                 # box:mmsi -> [(lat, lon, ts), ...] ~4min ring
_last_seen: dict[str, float] = {}             # box:mmsi -> ts (220ms dedup)
_zones: dict[str, int] = {}                   # box:mmsi -> zone (two-zone crossing machine)
_crossings: dict[str, dict[str, dict[str, int]]] = {}  # box -> hour_ts -> direction -> count
_alive = {"task": False}
_seed_cache: dict | None = None


def _db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(DB_PATH))
    c.executescript(SCHEMA)
    return c


def load_chokepoints() -> list[dict]:
    rows = json.loads(CURATED.read_text())
    live = [r for r in rows if r.get("live")]
    # sync registry table (idempotent)
    try:
        c = _db()
        for r in rows:
            c.execute(
                "INSERT OR REPLACE INTO chokepoint(id,name,bbox,live) VALUES(?,?,?,?)",
                (r["id"], r["name"], json.dumps(r["bbox"]), 1 if r.get("live") else 0),
            )
        c.commit()
        c.close()
    except Exception:
        pass
    return live


def _seed() -> dict:
    global _seed_cache
    if _seed_cache is None:
        try:
            _seed_cache = json.loads(SEED_PATH.read_text())
        except Exception:
            _seed_cache = {}
    return _seed_cache


def _in_box(box: list, lat: float, lon: float) -> bool:
    (la1, lo1), (la2, lo2) = box
    return min(la1, la2) <= lat <= max(la1, la2) and min(lo1, lo2) <= lon <= max(lo1, lo2)


def _zone_and_dir(bbox: list, lat: float, lon: float) -> tuple[int, str, str]:
    """Split the box across its LONG axis (aspect-derived, config-free).
    Returns (zone, forward_dir, backward_dir), e.g. eastbound/westbound."""
    (la1, lo1), (la2, lo2) = bbox
    if abs(lo2 - lo1) >= abs(la2 - la1):
        mid = (lo1 + lo2) / 2
        return (1 if lon >= mid else 0, "eastbound", "westbound")
    mid = (la1 + la2) / 2
    return (1 if lat >= mid else 0, "northbound", "southbound")


def _hour_ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00:00Z")


def ingest_message(msg: dict, boxes: list[dict] | None = None) -> bool:
    """Route one AISStream PositionReport into the right box. Returns True if stored."""
    try:
        meta = msg.get("MetaData", {})
        mmsi = str(meta.get("MMSI", msg.get("MMSI", "")))
        m = msg.get("Message", {}).get("PositionReport", msg.get("PositionReport", {}))
        lat, lon = float(m.get("Latitude", m.get("Lat", 0))), float(m.get("Longitude", m.get("Lon", 0)))
        sog = float(m.get("Sog", m.get("SOG", 0) or 0))
        cog = float(m.get("Cog", m.get("COG", 0) or 0))
    except Exception:
        return False
    boxes = boxes if boxes is not None else load_chokepoints()
    now = time.time()
    for b in boxes:
        if _in_box(b["bbox"], lat, lon):
            dk = f"{b['id']}:{mmsi}"
            with _lock:
                if now - _last_seen.get(dk, 0) < 0.22:  # 220ms dedup
                    return False
                _last_seen[dk] = now
                _positions.setdefault(b["id"], {})[mmsi] = {
                    "mmsi": mmsi, "lat": lat, "lon": lon, "sog": sog, "cog": cog,
                    "type": str(msg.get("ship_type", "other")).lower(), "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                # 4-min comet-trail ring buffer (deck.gl TripsLayer input)
                tr = _trails.setdefault(dk, [])
                tr.append((lat, lon, now))
                cutoff = now - 240
                while tr and (tr[0][2] < cutoff or len(tr) > 24):
                    tr.pop(0)
                # two-zone crossing machine: zone flip = one transit counted
                zone, fwd, bwd = _zone_and_dir(b["bbox"], lat, lon)
                prev = _zones.get(dk)
                _zones[dk] = zone
                if prev is not None and prev != zone:
                    hr = _hour_ts()
                    d = _crossings.setdefault(b["id"], {}).setdefault(hr, {})
                    d[fwd if zone == 1 else bwd] = d.get(fwd if zone == 1 else bwd, 0) + 1
            return True
    return False


def latest_snapshot(chokepoint_id: str) -> dict:
    from backend.models.source_record import make_record

    with _lock:
        box = _positions.get(chokepoint_id, {})
        pos = []
        for mmsi, p in list(box.items())[:2000]:
            q = dict(p)
            tr = _trails.get(f"{chokepoint_id}:{mmsi}", [])
            if len(tr) > 1:
                q["trail"] = [[la, lo] for la, lo, _ in tr]
            pos.append(q)
    return make_record("aisstream", "snapshot", {"positions": pos, "count": len(box)}, entity_id=chokepoint_id)


def baseline_7d(chokepoint_id: str) -> tuple[float, bool]:
    """Returns (avg, from_seed)."""
    try:
        c = _db()
        row = c.execute(
            "SELECT AVG(vessel_count) FROM traffic_hour WHERE chokepoint_id=? AND ts >= datetime('now','-7 days')",
            (chokepoint_id,),
        ).fetchone()
        n = c.execute(
            "SELECT COUNT(*) FROM traffic_hour WHERE chokepoint_id=? AND ts >= datetime('now','-7 days')",
            (chokepoint_id,),
        ).fetchone()[0]
        c.close()
        if row and row[0] is not None and n >= 24:
            return float(row[0]), False
    except Exception:
        pass
    return float(_seed().get(chokepoint_id, {}).get("baseline_7d", 50)), True


def traffic_anomaly(chokepoint_id: str) -> dict:
    from backend.models.source_record import make_record

    with _lock:
        count = len(_positions.get(chokepoint_id, {}))
    base, from_seed = baseline_7d(chokepoint_id)
    if count == 0:  # no live data yet -> seed count so map never renders empty
        s = _seed().get(chokepoint_id, {})
        count = int(s.get("baseline_7d", base))
        stale = True
    else:
        stale = from_seed
    pct = ((count - base) / base * 100.0) if base else 0.0
    return make_record(
        "aisstream", "traffic_anomaly",
        {"count": count, "baseline_7d": base, "pct_change": round(pct, 2), "stale": stale},
        entity_id=chokepoint_id,
    )


def most_anomalous() -> dict:
    best, best_abs = None, -1.0
    for b in load_chokepoints():
        rec = traffic_anomaly(b["id"])
        a = abs(rec["payload"].get("pct_change", 0))
        if a > best_abs:
            best_abs, best = a, rec
    return best or traffic_anomaly("hormuz")


def flush_positions() -> None:
    with _lock:
        snap = {k: dict(v) for k, v in _positions.items()}
        cross = {k: {h: dict(d) for h, d in v.items()} for k, v in _crossings.items()}
    try:
        c = _db()
        for box, mmsis in snap.items():
            for mmsi, p in mmsis.items():
                c.execute(
                    "INSERT OR REPLACE INTO positions_cache(chokepoint_id,mmsi,lat,lon,sog,cog,type,updated_at) VALUES(?,?,?,?,?,?,?,?)",
                    (box, mmsi, p["lat"], p["lon"], p.get("sog", 0), p.get("cog", 0), p.get("type", "other"), p["updated_at"]),
                )
        for box, hours in cross.items():
            for hr, dirs in hours.items():
                for direction, n in dirs.items():
                    c.execute(
                        "INSERT INTO crossing_hour(chokepoint_id,ts,direction,crossings) VALUES(?,?,?,?) "
                        "ON CONFLICT(chokepoint_id,ts,direction) DO UPDATE SET crossings=excluded.crossings",
                        (box, hr, direction, n),
                    )
        c.commit()
        c.close()
    except Exception:
        pass


def rollup_hour() -> None:
    with _lock:
        snap = {k: dict(v) for k, v in _positions.items()}
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00:00Z")
    try:
        c = _db()
        boxes = [b["id"] for b in load_chokepoints()]
        for box in boxes:
            mmsis = snap.get(box, {})
            n = len(mmsis)
            if n == 0:
                continue
            tanker = sum(1 for p in mmsis.values() if p.get("type") == "tanker")
            cargo = sum(1 for p in mmsis.values() if p.get("type") == "cargo")
            c.execute(
                "INSERT OR REPLACE INTO traffic_hour(chokepoint_id,ts,vessel_count,tanker_count,cargo_count) VALUES(?,?,?,?,?)",
                (box, ts, n, tanker, cargo),
            )
        c.commit()
        c.close()
    except Exception:
        pass


def history(chokepoint_id: str, hours: int = 720) -> dict:
    """Traffic counts + crossings per hour (cap 720h = 30d). Feeds mini-chart + playback."""
    from backend.models.source_record import make_record

    hours = max(1, min(int(hours), 720))
    try:
        c = _db()
        counts = c.execute(
            "SELECT ts, vessel_count, tanker_count, cargo_count FROM traffic_hour "
            "WHERE chokepoint_id=? ORDER BY ts DESC LIMIT ?",
            (chokepoint_id, hours),
        ).fetchall()
        cross = c.execute(
            "SELECT ts, direction, crossings FROM crossing_hour "
            "WHERE chokepoint_id=? ORDER BY ts DESC LIMIT ?",
            (chokepoint_id, hours * 2),
        ).fetchall()
        c.close()
    except Exception as e:
        return make_record("aisstream", "history", {"status": "skipped", "reason": str(e)}, entity_id=chokepoint_id)
    return make_record(
        "aisstream", "history",
        {"counts": [{"ts": r[0], "vessels": r[1], "tankers": r[2], "cargo": r[3]} for r in reversed(counts)],
         "crossings": [{"ts": r[0], "direction": r[1], "crossings": r[2]} for r in reversed(cross)],
         "stale": len(counts) < 24},
        entity_id=chokepoint_id,
    )


async def run_ais_manager(on_update=None) -> None:
    """ONE connection. Exp-backoff+jitter, resend replaces subscription."""
    import os

    boxes = load_chokepoints()
    _alive["task"] = True
    api_key = os.environ.get("AISSTREAM_API_KEY", "")
    if not api_key:
        _alive["task"] = "no-key"
        return
    try:
        import websockets
    except ImportError:
        _alive["task"] = "no-websockets"
        return
    bboxes = [b["bbox"] for b in boxes]  # [[lat,lon],[lat,lon]] per spec
    # AISStream expects [[[lon_min,lat_min],[lon_max,lat_max]],...]; convert
    wire = [[[[b[0][1], b[0][0]], [b[1][1], b[1][0]]]] for b in bboxes]
    flat = [w[0] for w in wire]
    backoff = 5
    while True:
        try:
            async with websockets.connect(
                "wss://stream.aisstream.io/v0/stream",
                compression="deflate",  # permessage-deflate
                ping_interval=20,
            ) as ws:
                await ws.send(json.dumps({
                    "APIKey": api_key,
                    "BoundingBoxes": flat,
                    "FilterMessageTypes": ["PositionReport", "ShipStaticData"],
                }))
                backoff = 5
                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue
                    ingest_message(msg, boxes)
                    if on_update:
                        try:
                            on_update(msg)
                        except Exception:
                            pass
        except Exception:
            await asyncio.sleep(backoff + random.uniform(0, backoff * 0.3))
            backoff = min(backoff * 2, 120)


def is_alive() -> str:
    return str(_alive.get("task"))

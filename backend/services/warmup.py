"""Startup auto-warm: backfill SQLite baselines + pre-fill in-memory TTL cache.

Runs once per process as a background task from lifespan — never blocks boot.
Idempotent: DB backfill is INSERT OR IGNORE; service calls are plain fetches
that populate the TTL cache exactly as a first user walkthrough would.

Deliberately NOT recording raw provider payloads here — recording spends
SerpApi/AlphaVantage quota on purpose, so it stays manual:
`MOCK_MODE=false python scripts/warm_cache.py`.
"""
from __future__ import annotations

import json
import pathlib
import sqlite3
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
SEED = ROOT / "backend" / "data" / "seed_baseline.json"
RECORDING = ROOT / "backend" / "data" / "warm_cache.json"

STATUS: dict = {"warming": False, "warmed_at": None, "warm_error": None, "services": {}}
_started = False


def mock_mode() -> bool:
    import os

    return os.environ.get("MOCK_MODE", "").lower() == "true"


def recording_present() -> bool:
    return RECORDING.exists() and RECORDING.stat().st_size > 0


def db_seeded() -> bool:
    try:
        from backend.providers.aisstream import _db  # noqa: SLF001

        c = _db()
        try:
            return c.execute("SELECT COUNT(*) FROM traffic_hour").fetchone()[0] > 0
        finally:
            c.close()
    except Exception:
        return False


def backfill_db_from_seed() -> str:
    """INSERT OR IGNORE seed baselines. Same logic scripts/warm_cache.py used inline."""
    from backend.providers.aisstream import _db, load_chokepoints  # noqa: SLF001

    load_chokepoints()
    seed = json.loads(SEED.read_text())
    c: sqlite3.Connection = _db()
    try:
        for cid, row in seed.items():
            c.execute(
                "INSERT OR IGNORE INTO traffic_hour(chokepoint_id,ts,vessel_count,tanker_count,cargo_count)"
                " VALUES(?,?,?,0,0)",
                (cid, "2026-09-10T00:00:00Z", row["baseline_7d"]),
            )
        c.commit()
    finally:
        c.close()
    return f"db backfilled from seed ({len(seed)} chokepoints)"


def _calls():
    from backend.services import (  # noqa: PLC0415
        asset_service,
        cross_market_service,
        events_service,
        layers_service,
        map_service,
        market_home_service,
        search_service,
    )

    return [
        ("market-home", market_home_service.get_home),
        ("asset/BRENT", lambda: asset_service.get_asset("BRENT")),
        ("asset/AAPL", lambda: asset_service.get_asset("AAPL")),
        ("events", events_service.get_events),
        ("cross-market", cross_market_service.get_matrix),
        ("map", map_service.get_all_maps),
        ("map/hormuz/history", lambda: map_service.get_history("hormuz", 48)),
        ("search", lambda: search_service.search("BRENT")),
        ("layers/weather", lambda: layers_service.get_layer("weather")),
    ]


def warm_services() -> dict:
    results: dict = {}
    for name, fn in _calls():
        try:
            fn()
            results[name] = "ok"
        except Exception as e:
            results[name] = f"skipped: {e}"
    STATUS["services"] = results
    return results


def ensure_warm() -> dict:
    """Entry point for the lifespan background task. Never raises."""
    global _started
    if _started:
        return STATUS
    _started = True
    STATUS["warming"] = True
    try:
        if not db_seeded():
            try:
                print(f"warmup: {backfill_db_from_seed()}", flush=True)
            except Exception as e:
                print(f"warmup: db backfill skipped: {e}", flush=True)
        else:
            print("warmup: db already seeded", flush=True)
        results = warm_services()
        ok = sum(1 for v in results.values() if v == "ok")
        print(f"warmup: services {ok}/{len(results)} ok", flush=True)
        if mock_mode() and not recording_present():
            print(
                "warmup: WARNING MOCK_MODE=true but backend/data/warm_cache.json is missing — "
                "replay will serve stubs. Record once: MOCK_MODE=false python scripts/warm_cache.py",
                flush=True,
            )
        STATUS["warmed_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    except Exception as e:  # pragma: no cover — belt and braces
        STATUS["warm_error"] = str(e)
        print(f"warmup: failed: {e}", flush=True)
    finally:
        STATUS["warming"] = False
    return STATUS

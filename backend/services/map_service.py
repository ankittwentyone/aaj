"""Map service — per-chokepoint get_map(id)/get_all_maps, never hardcodes bboxes."""
from __future__ import annotations

from datetime import datetime, timezone


def _boxes() -> list[dict]:
    from backend.providers.aisstream import load_chokepoints

    return load_chokepoints()


def get_map(chokepoint_id: str) -> dict:
    from backend.providers import aisstream

    box = next((b for b in _boxes() if b["id"] == chokepoint_id), None)
    if box is None:
        return {"error": f"unknown chokepoint {chokepoint_id}"}
    snap = aisstream.latest_snapshot(chokepoint_id)
    anom = aisstream.traffic_anomaly(chokepoint_id)
    positions = snap.get("payload", {}).get("positions", []) if isinstance(snap, dict) else []
    if not positions:
        # seed fallback so map never renders empty
        import json
        import pathlib

        try:
            seed = json.loads((pathlib.Path(__file__).resolve().parents[1] / "data" / "seed_baseline.json").read_text())
            positions = seed.get(chokepoint_id, {}).get("sample_positions", [])
        except Exception:
            positions = []
    p = anom.get("payload", {}) if isinstance(anom, dict) else {}
    from backend.services._evidence import collect, static_note

    evidence = collect(snap, anom)
    if p.get("stale"):
        evidence.append(static_note("seed_baseline.json", f"seed fallback for {chokepoint_id}; live AIS not yet logged"))
    return {
        "id": chokepoint_id, "bbox": box["bbox"], "name": box["name"],
        "count": p.get("count", len(positions)), "baseline_7d": p.get("baseline_7d"),
        "pct_change": p.get("pct_change"), "positions": positions,
        "retrieved_at": datetime.now(timezone.utc).isoformat(), "stale": p.get("stale", True),
        "evidence": evidence,
    }


def get_all_maps() -> list[dict]:
    return [get_map(b["id"]) for b in _boxes()]


def get_history(chokepoint_id: str, hours: int = 720) -> dict:
    """Traffic counts + crossings per hour for mini-chart + 30-day playback."""
    from backend.providers import aisstream

    if not any(b["id"] == chokepoint_id for b in _boxes()):
        return {"error": f"unknown chokepoint {chokepoint_id}"}
    rec = aisstream.history(chokepoint_id, hours)
    from backend.services._evidence import collect

    return {**rec.get("payload", {}), "id": chokepoint_id,
            "retrieved_at": rec.get("retrieved_at"), "evidence": collect(rec)}

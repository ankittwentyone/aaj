"""Thin service over providers/layers.py — one endpoint, three feeds."""
from __future__ import annotations


def get_layer(feed: str) -> dict:
    from backend.providers import layers
    from backend.services._evidence import collect

    fn = {"weather": layers.weather, "earthquakes": layers.earthquakes, "disasters": layers.disasters}.get(feed)
    if fn is None:
        return {"error": f"unknown feed {feed}", "feeds": ["weather", "earthquakes", "disasters"]}
    try:
        rec = fn()
    except Exception as e:
        return {"feed": feed, "status": "skipped", "reason": str(e)}
    return {"feed": feed, **rec.get("payload", {}), "retrieved_at": rec.get("retrieved_at"), "evidence": collect(rec)}

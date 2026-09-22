"""Command-palette index (GET /api/search): tickers + chokepoints + event
categories + shock assets. Pure routing over curated data, no new fetch."""
from __future__ import annotations

import json
import pathlib

_CUR = pathlib.Path(__file__).resolve().parents[1] / "data" / "curated"


def _index() -> list[dict]:
    entries: list[dict] = []
    try:
        for display in json.loads((_CUR / "tickers.json").read_text()):
            entries.append({"label": display, "type": "asset", "route": f"/asset/{display}"})
    except Exception:
        pass
    try:
        for c in json.loads((_CUR / "chokepoints.json").read_text()):
            entries.append({"label": c["name"], "type": "chokepoint",
                            "route": f"/map#{c['id']}", "id": c["id"]})
            entries.append({"label": c["id"].upper(), "type": "chokepoint",
                            "route": f"/map#{c['id']}", "id": c["id"]})
    except Exception:
        pass
    try:
        for cat in json.loads((_CUR / "event_chain.json").read_text()):
            entries.append({"label": f"WHY {cat.upper()}?", "type": "event", "route": f"/events#{cat}"})
    except Exception:
        pass
    try:
        for shock in json.loads((_CUR / "sensitivity_matrix.json").read_text()):
            entries.append({"label": f"{shock} SHOCK", "type": "scenario", "route": f"/cross-market#{shock}"})
    except Exception:
        pass
    return entries


def search(q: str, limit: int = 8) -> dict:
    needle = (q or "").strip().lower()
    if not needle:
        return {"results": []}
    scored = []
    for e in _index():
        label = e["label"].lower()
        if label.startswith(needle):
            scored.append((0, e))
        elif needle in label:
            scored.append((1, e))
    scored.sort(key=lambda t: (t[0], t[1]["label"]))
    return {"query": q, "results": [e for _, e in scored[: max(1, min(limit, 20))]]}

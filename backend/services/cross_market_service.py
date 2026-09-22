"""Cross-market service — curated static matrix + SerpApi-discovered dashed candidates."""
from __future__ import annotations

import json
import pathlib


def _matrix() -> dict:
    p = pathlib.Path(__file__).resolve().parents[1] / "data" / "curated" / "sensitivity_matrix.json"
    return json.loads(p.read_text())


def _chokepoints() -> list[dict]:
    p = pathlib.Path(__file__).resolve().parents[1] / "data" / "curated" / "chokepoints.json"
    return json.loads(p.read_text())


def get_matrix() -> dict:
    m = _matrix()
    candidates = []
    candidate_records = []
    # SerpApi-discovered dashed edges: best-effort, never breaks the static matrix
    try:
        from backend.providers import serpapi

        for shock in list(m.keys())[:2]:
            try:
                res = serpapi.google_search(f"{shock} impact sectors stocks", num=3)
                for r in res if isinstance(res, list) else []:
                    p = r.get("payload", {}) or {}
                    candidates.append({"from": shock, "to": "?", "dashed": True,
                                       "evidence": p.get("snippet", "")[:120],
                                       "source_url": r.get("source_url")})
                    candidate_records.append(r)
            except Exception:
                continue
    except Exception:
        pass
    from backend.services._evidence import collect, static_note

    evidence = collect(candidate_records)
    evidence.append(static_note("sensitivity_matrix.json", "human-authored solid edges"))
    evidence.append(static_note("chokepoints.json commodity_tags", "drives exposed_chokepoints"))
    return {"matrix": m, "candidate_edges": candidates, "evidence": evidence}


def simulate(shock_asset: str, shock_value: float) -> dict:
    """Scenario slider: arithmetic over static matrix. Returns exposures + exposed chokepoints."""
    m = _matrix()
    edges = m.get(shock_asset, [])
    exposures = []
    for e in edges:
        exposures.append({
            "target": e["target"],
            "exposure": round(shock_value * e.get("weight", 0) * e.get("direction", 1), 2),
            "weight": e.get("weight"), "rationale": e.get("rationale"),
        })
    exposed_boxes = [c["id"] for c in _chokepoints() if c.get("live") and shock_asset in c.get("commodity_tags", [])]
    from backend.services._evidence import static_note

    return {"shock_asset": shock_asset, "shock_value": shock_value, "exposures": exposures, "exposed_chokepoints": exposed_boxes,
            "evidence": [static_note("sensitivity_matrix.json", "pure arithmetic over curated weights, no live fetch")]}

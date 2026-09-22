"""resolve — deterministic entity resolution (ticker/commodity/event lookup). Non-LLM."""
from __future__ import annotations


def resolve(state: dict) -> dict:
    from research_desk.nodes._util import now, trace_entry

    from backend.providers import serpapi

    started = now()
    q = (state.get("query") or "").strip()
    asset = None
    # 1) curated tickers map (BRENT, AAPL, ...)
    try:
        import json
        import pathlib

        tickers = json.loads(
            (pathlib.Path(__file__).resolve().parents[2] / "backend" / "data" / "curated" / "tickers.json").read_text()
        )
        up = q.upper()
        for display in tickers:
            if display in up:
                asset = display
                break
    except Exception:
        pass
    # 2) "why is X moving" pattern
    if asset is None:
        import re

        m = re.search(r"why is (\w+) moving", q.lower())
        if m:
            asset = m.group(1).upper()
    resolved = {"asset": asset, "query": q}
    status = "done" if asset else "skipped"
    if asset is None:
        # short-circuit signal: downstream nodes check resolved_entity; synthesize
        # emits "not enough data" when nothing was collected (see synthesize.py).
        resolved["reason"] = "no known entity in query"
    entry = trace_entry("resolve", status, started_at=started, finished_at=now(), asset=asset)
    try:
        serpapi.search_trace("resolve", q)
    except Exception:
        pass
    return {"asset": asset, "resolved_entity": resolved, "trace": [*state.get("trace", []), entry]}

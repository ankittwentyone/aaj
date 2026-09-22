"""market_pull — reuses API-layer services in-process, never refetches raw. Non-LLM."""
from __future__ import annotations


def market_pull(state: dict) -> dict:
    from research_desk.nodes._util import now, trace_entry

    started = now()
    asset = state.get("asset")
    trace = list(state.get("trace", []))
    if not asset:
        trace.append(trace_entry("market_pull", "skipped", started_at=started, finished_at=now(), reason="unresolved entity"))
        return {"market_data": None, "trace": trace}
    try:
        from backend.services import asset_service

        data = asset_service.get_asset(asset)
        ev = [data.get("quote"), data.get("fundamentals")]
        trace.append(trace_entry("market_pull", "done", started_at=started, finished_at=now(), asset=asset))
        return {"market_data": data, "evidence": [*state.get("evidence", []), *[e for e in ev if e]], "trace": trace}
    except Exception as e:
        trace.append(trace_entry("market_pull", "skipped", started_at=started, finished_at=now(), reason=str(e)))
        return {"market_data": {"status": "skipped", "reason": str(e)}, "trace": trace}

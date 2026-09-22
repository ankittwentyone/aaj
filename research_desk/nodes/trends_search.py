"""trends_search — SerpApi google_trends. Non-LLM, timeout-guarded."""
from __future__ import annotations


def trends_search(state: dict) -> dict:
    from research_desk.nodes._util import now, trace_entry

    started = now()
    asset = state.get("asset") or state.get("query", "")
    trace = list(state.get("trace", []))
    try:
        from research_desk.tools.serpapi_tool import trends_tool

        rec = trends_tool(asset)
        trace.append(trace_entry("trends_search", "done", started_at=started, finished_at=now(),
                                 engine="google_trends", query=asset, result_count=1))
        return {"trends_results": rec, "evidence": [*state.get("evidence", []), rec], "trace": trace}
    except Exception as e:
        trace.append(trace_entry("trends_search", "skipped", started_at=started, finished_at=now(),
                                 engine="google_trends", query=asset, reason=str(e)))
        return {"trends_results": None, "trace": trace}

"""web_search — SerpApi google_search, ONLY if follow-up chosen. Bounded count."""
from __future__ import annotations


def web_search(state: dict) -> dict:
    from research_desk.config import SEARCH_BUDGET
    from research_desk.nodes._util import now, trace_entry

    started = now()
    q = state.get("follow_up_query")
    trace = list(state.get("trace", []))
    if not q:
        trace.append(trace_entry("web_search", "skipped", started_at=started, finished_at=now(), reason="no follow-up query"))
        return {"search_results": [], "trace": trace}
    try:
        from research_desk.tools.serpapi_tool import search_tool

        items = search_tool(q, num=SEARCH_BUDGET["web_search"])
        n = len(items) if isinstance(items, list) else 0
        trace.append(trace_entry("web_search", "done", started_at=started, finished_at=now(),
                                 engine="google_search", query=q, result_count=n))
        return {"search_results": items if isinstance(items, list) else [],
                "evidence": [*state.get("evidence", []), *(items if isinstance(items, list) else [])],
                "trace": trace}
    except Exception as e:
        trace.append(trace_entry("web_search", "skipped", started_at=started, finished_at=now(),
                                 engine="google_search", query=q, reason=str(e)))
        return {"search_results": [], "trace": trace}

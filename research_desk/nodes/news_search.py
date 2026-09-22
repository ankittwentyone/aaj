"""news_search — SerpApi google_news via serpapi_tool. Non-LLM, timeout-guarded."""
from __future__ import annotations


def news_search(state: dict) -> dict:
    from research_desk.config import SEARCH_BUDGET
    from research_desk.nodes._util import now, trace_entry

    started = now()
    asset = state.get("asset") or state.get("query", "")
    template = f"{asset} price news catalyst"
    trace = list(state.get("trace", []))
    try:
        from research_desk.tools.serpapi_tool import news_tool

        items = news_tool(template, num=SEARCH_BUDGET["news"])
        n = len(items) if isinstance(items, list) else 0
        trace.append(trace_entry("news_search", "done", started_at=started, finished_at=now(),
                                 engine="google_news", query=template, result_count=n))
        return {"news_results": items if isinstance(items, list) else [],
                "evidence": [*state.get("evidence", []), *(items if isinstance(items, list) else [])],
                "trace": trace}
    except Exception as e:
        trace.append(trace_entry("news_search", "skipped", started_at=started, finished_at=now(),
                                 engine="google_news", query=template, reason=str(e)))
        return {"news_results": [], "trace": trace}

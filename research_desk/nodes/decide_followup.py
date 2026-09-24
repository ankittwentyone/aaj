"""decide_followup — THE one agentic branch. Strict JSON, max 1 query, no loop.

Mitigations: parse retry <=2, default None on failure; stub to None without key
so graph.stream() runs end-to-end keyless (acceptance criterion).
"""
from __future__ import annotations

import json
import os


def _summarize(items: list, limit: int = 5) -> str:
    bits = []
    for it in (items or [])[:limit]:
        p = it.get("payload", {}) if isinstance(it, dict) else {}
        bits.append(p.get("title", p.get("snippet", ""))[:140])
    return "\n".join(f"- {b}" for b in bits if b)


def decide_followup(state: dict) -> dict:
    from research_desk.nodes._util import now, trace_entry

    started = now()
    trace = list(state.get("trace", []))
    import os

    if not (os.environ.get("LLM_API_KEY") or os.environ.get("GROQ_API_KEY") or os.environ.get("DEEPSEEK_API_KEY")):
        trace.append(trace_entry("decide_followup", "skipped", started_at=started, finished_at=now(), reason="no LLM_API_KEY (groq)"))
        return {"follow_up_query": None, "trace": trace}
    prompt = (
        'You are a market-research router. Given fresh news headlines and attention signals, '
        'output STRICT JSON: {"follow_up_query": string|null}. One specific web-search query to verify '
        'the leading catalyst, or null if news already suffices. Plain text only, no $ or quotes. No other text.\n\n'
        f"ASSET: {state.get('asset')}\nNEWS:\n{_summarize(state.get('news_results', []))}\n"
        f"TRENDS: {str(state.get('trends_results', {}).get('payload', {}))[:600] if state.get('trends_results') else 'none'}"
    )
    query: str | None = None
    last_err = ""
    for _ in range(2):  # parse retry <= 2
        try:
            from research_desk.config import llm_client

            llm = llm_client("decide_followup")
            raw = llm.invoke(prompt)
            text = getattr(raw, "content", str(raw)).strip()
            # tolerate code fences
            if text.startswith("```"):
                text = text.strip("`").split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            query = json.loads(text).get("follow_up_query") or None
            break
        except Exception as e:
            last_err = str(e)
    trace.append(trace_entry("decide_followup", "done" if query else "skipped",
                             started_at=started, finished_at=now(),
                             follow_up_query=query, reason=last_err if not query and last_err else None))
    return {"follow_up_query": query, "trace": trace}

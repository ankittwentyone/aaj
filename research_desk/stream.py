"""WS /ws/research/{session_id} — forwards graph.stream() node events to frontend.

Each event is simultaneously the 'Searching news...' narration AND the raw
material for the search-trace panel (SerpApi stages carry query/engine/result_count).
Spec §7. Acceptance: trace events {stage, status, query, engine, result_count, timestamp}.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket

router = APIRouter()


def _agent_log(session: str, msg: str) -> None:
    """Stdout for run.sh tail — unbuffered agent transcript."""
    print(f"[agent] session={session[:8]}… {msg}", flush=True)


STAGE_LABELS = {
    "resolve": "Resolving asset...",
    "market_pull": "Pulling market data...",
    "news_search": "Searching news...",
    "trends_search": "Checking trends...",
    "decide_followup": "Deciding follow-up...",
    "web_search": "Searching web...",
    "physical_corroborate": "Checking physical signals...",
    "synthesize": "Writing report...",
}


@router.post("/api/research/run")
def research_run(body: dict):
    from research_desk.graph import run

    q = body.get("query", "")
    _agent_log("http", f"POST /api/research/run query={q[:120]!r}")
    final = run(q)
    _agent_log("http", f"done evidence={len(final.get('evidence') or [])} report_chars={len(final.get('report') or '')}")
    ev = final.get("evidence", []) or []
    return {
        "report": final.get("report"),
        "trace": final.get("trace", []),
        "evidence_count": len(ev),
        "evidence": ev,
    }


@router.websocket("/ws/research/{session_id}")
async def ws_research(ws: WebSocket, session_id: str):
    import asyncio

    from research_desk.graph import graph
    from research_desk.state import fresh_state

    await ws.accept()
    _agent_log(session_id, "ws connected")
    try:
        raw = await ws.receive_text()
        try:
            query = json.loads(raw).get("query", raw)
        except Exception:
            query = raw
        _agent_log(session_id, f"query={str(query)[:120]!r}")
        loop = asyncio.get_running_loop()
        # stream node completions; run blocking .stream in a thread
        events: asyncio.Queue = asyncio.Queue()
        final_state: dict = {}

        def _pump():
            try:
                for chunk in graph.stream(fresh_state(query), stream_mode="updates"):
                    for node, update in chunk.items():
                        if isinstance(update, dict):
                            final_state.update(update)
                        trace = (update or {}).get("trace", [])
                        last = trace[-1] if trace else {"stage": node, "status": "done"}
                        payload = {
                            "session": session_id,
                            "node": node,
                            "label": STAGE_LABELS.get(node, node),
                            **last,
                        }
                        eng = last.get("engine") or ""
                        q = last.get("query") or ""
                        rc = last.get("result_count")
                        st = last.get("status") or "done"
                        _agent_log(
                            session_id,
                            f"node={node} status={st}"
                            + (f" engine={eng}" if eng else "")
                            + (f" results={rc}" if rc is not None else "")
                            + (f" q={q[:80]!r}" if q else ""),
                        )
                        loop.call_soon_threadsafe(events.put_nowait, payload)
            except Exception as e:
                _agent_log(session_id, f"error={e}")
                loop.call_soon_threadsafe(events.put_nowait, {"session": session_id, "error": str(e)})
            finally:
                loop.call_soon_threadsafe(events.put_nowait, None)

        import threading

        threading.Thread(target=_pump, daemon=True).start()
        while True:
            ev = await events.get()
            if ev is None:
                break
            await ws.send_text(json.dumps(ev, default=str))
        # reuse streamed state — do NOT graph.invoke() again (would double SerpApi+LLM cost)
        ev = final_state.get("evidence", []) or []
        _agent_log(session_id, f"final evidence={len(ev)} report_chars={len(final_state.get('report') or '')}")
        await ws.send_text(json.dumps({
            "session": session_id,
            "final": True,
            "report": final_state.get("report"),
            "evidence_count": len(ev),
            "evidence": ev,
        }, default=str))
    except Exception:
        pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass

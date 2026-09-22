"""WS /ws/research/{session_id} — forwards graph.stream() node events to frontend.

Each event is simultaneously the 'Searching news...' narration AND the raw
material for the search-trace panel (SerpApi stages carry query/engine/result_count).
Spec §7. Acceptance: trace events {stage, status, query, engine, result_count, timestamp}.
"""
from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket

router = APIRouter()

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
    final = run(q)
    return {"report": final.get("report"), "trace": final.get("trace", []),
            "evidence_count": len(final.get("evidence", []))}


@router.websocket("/ws/research/{session_id}")
async def ws_research(ws: WebSocket, session_id: str):
    import asyncio

    from research_desk.graph import graph
    from research_desk.state import fresh_state

    await ws.accept()
    try:
        raw = await ws.receive_text()
        try:
            query = json.loads(raw).get("query", raw)
        except Exception:
            query = raw
        loop = asyncio.get_event_loop()
        # stream node completions; run blocking .stream in a thread
        events: asyncio.Queue = asyncio.Queue()

        def _pump():
            try:
                for chunk in graph.stream(fresh_state(query), stream_mode="updates"):
                    for node, update in chunk.items():
                        trace = (update or {}).get("trace", [])
                        last = trace[-1] if trace else {"stage": node, "status": "done"}
                        loop.call_soon_threadsafe(events.put_nowait,
                                                  {"session": session_id, "node": node,
                                                   "label": STAGE_LABELS.get(node, node), **last})
            except Exception as e:
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
        # final full state for the report pane
        final = graph.invoke(fresh_state(query))
        await ws.send_text(json.dumps({"session": session_id, "final": True,
                                       "report": final.get("report"),
                                       "evidence_count": len(final.get("evidence", []))}, default=str))
    except Exception:
        pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass

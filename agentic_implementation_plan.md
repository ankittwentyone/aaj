# Research Desk — Implementation Plan (Claude Code handoff)

Base: fork/scaffold from `langchain-ai/open_deep_research` (LangGraph). Swap its search backend for SerpApi, point its model config at DeepSeek, expose its native node streaming to the frontend as the search-trace panel. This plan assumes that scaffold as the starting point rather than a from-scratch LangGraph build.

---

## 1. Directory structure

```
research_desk/
  state.py            # ResearchState TypedDict
  graph.py             # LangGraph StateGraph: nodes + edges + conditional branch
  nodes/
    resolve.py          # entity resolution (ticker/commodity/event lookup)
    market_pull.py       # calls into backend/services (reuse API layer, don't refetch)
    news_search.py        # SerpApi google_news via serpapi.py
    trends_search.py       # SerpApi google_trends
    decide_followup.py      # LLM call: 0 or 1 follow-up query, hard-capped
    web_search.py             # SerpApi google_search (only if follow-up chosen)
    physical_corroborate.py    # pulls AIS anomaly / EIA / FRED via existing services
    synthesize.py                # single LLM call → cited report
  tools/
    serpapi_tool.py       # thin wrapper exposing serpapi.py functions as LangGraph tools
  config.py              # DeepSeek model config per stage, timeouts
  stream.py               # SSE/WS endpoint forwarding graph.stream() events to frontend
```

**Reuse, don't duplicate:** `market_pull` and `physical_corroborate` call the *services* built in the API plan (`market_home_service`, `asset_service`, `map_service`), not the raw providers again. The agent should never re-implement data fetching that the deterministic layer already does.

## 2. State schema

```python
class ResearchState(TypedDict):
    query: str
    asset: str | None
    resolved_entity: dict | None
    market_data: dict | None
    news_results: list[SourceRecord]
    trends_results: SourceRecord | None
    follow_up_query: str | None
    search_results: list[SourceRecord]
    physical_signal: dict | None
    evidence: list[SourceRecord]        # accumulated across all stages, feeds report + evidence hover cards
    report: str | None
    trace: list[dict]                    # {stage, status, started_at, finished_at} — drives the UI panel
```

## 3. Graph — fixed pipeline, one conditional branch

```
START
  → resolve
  → market_pull
  → news_search
  → trends_search
  → decide_followup          (LLM: read news+trends, output follow_up_query or None)
      ├─ if follow_up_query set → web_search → physical_corroborate
      └─ if None                → physical_corroborate  (skip web_search)
  → synthesize
  → END
```

This is the *only* place real agentic choice lives — everything else is a fixed edge. Don't add more conditional branches for MVP; each one is a new way the demo can behave unpredictably.

## 4. Node-level guardrails (build these in from the start, not as a fix later)

- Every network-calling node: hard timeout (e.g. 15s). On timeout/failure, write `{"status": "skipped", "reason": ...}` into `trace` for that stage and continue — never let one dead provider hang the whole run.
- `decide_followup`: **hard cap of 1 follow-up query.** No loop, no re-evaluation.
- `web_search`: bounded result count (align with your SerpApi budget plan — 5-ish results).
- If `resolve` fails to find a known entity, short-circuit straight to a "not enough data" report rather than continuing through empty stages.

## 5. Model config

```python
# config.py
MODEL_CONFIG = {
    "decide_followup": deepseek_model,   # cheap, single short decision
    "synthesize": deepseek_model,        # final report generation
}
```
Keep every stage on DeepSeek (cloud) per your compute-cost constraint — no local inference on the hot path. `resolve`/`market_pull`/`news_search`/`trends_search`/`web_search`/`physical_corroborate` are non-LLM nodes (pure function calls into providers/services); only `decide_followup` and `synthesize` touch the model.

## 6. Report synthesis — prompt structure (from aajmvp.md F7, unchanged)

Output sections, enforced via prompt + light parsing:
```
- Executive thesis
- What happened
- Primary drivers
- Supporting evidence
- Contradicting evidence
- Affected assets
- What to watch next
- Confidence
- Sources + timestamps
```
Every claim in the body should map back to an entry in `state["evidence"]` — this is what feeds the evidence-hover-card UI primitive, so don't let `synthesize` produce claims that aren't traceable to a collected `SourceRecord`.

## 7. Streaming to frontend

```
WS /ws/research/{session_id}
```
Forward each `graph.stream()` node-completion event as it fires:
```json
{"stage": "news_search", "status": "running" | "done" | "skipped", "timestamp": "..."}
```
This event stream is simultaneously the "Searching news... Checking trends..." narration AND the raw material for the search-trace panel (add `query`, `engine`, `result_count` to the SerpApi-stage events specifically — that's the panel judges see).

## 8. Build order

1. `state.py` + `graph.py` skeleton with stub nodes (return dummy data) — get the graph running end-to-end before any real integration, to lock the shape early.
2. Wire `resolve` + `market_pull` to the real API-layer services (needs API plan Phase 2 done first).
3. Wire `news_search` + `trends_search` to `serpapi_tool.py`.
4. `decide_followup` + `web_search` — the one real agentic branch.
5. `physical_corroborate` — wire to `map_service`/FRED once API plan Phase 5 is done.
6. `synthesize` — prompt + evidence-linking.
7. `stream.py` — WS endpoint + frontend trace panel wiring.
8. Guardrails pass: add timeouts/fallbacks to every node explicitly (don't assume they're fine — test each one by intentionally breaking its upstream provider).

Steps 1–7 give you the full Hero-1 "why is oil moving?" flow working. Step 8 is what keeps it from breaking live on demo day — don't skip it to save time; it's cheaper to build than to debug a hang during a recording.

## 9. Dependency on the API plan

This whole graph assumes `backend/services/*` and `backend/providers/serpapi.py` (with key-rotation pool) already exist — build the API plan's Phases 1–2 before starting step 2 here. `decide_followup`/`web_search`/`synthesize` (steps 3–6) are the first genuinely new code; everything upstream of that should be thin wiring into work already done.

## 10. Locked framework decision (Sept 2026 — do not re-debate)

- **Framework = LangGraph via `langchain-ai/open_deep_research` scaffold (MIT).** Clone/fork it; do NOT build a StateGraph from scratch. It already implements scope→research→write and natively streams node state — that stream drives the "Searching news..." narration + search-trace panel for free.
- **Why not CrewAI / AutoGen / Hermes:** CrewAI's team metaphor and AutoGen's conversational swarm add coordination overhead for a fixed 7-stage pipeline with one branch. **Hermes is retired** as orchestration harness; LangGraph replaces it. No other agent framework.
- **Model = DeepSeek via `langchain-deepseek` (`ChatDeepSeek`, `DEEPSEEK_API_KEY`, `model="deepseek-chat"`).** Reuses existing stock-research tool setup. Cloud inference only — no local GPU on hot path. `pip install langchain-deepseek langgraph`.
- **DeepSeek caveat (from scaffold notes): weak function-calling.** Mitigations (mandatory):
  1. Disable Tavily default; inject ONLY `tools/serpapi_tool.py` (news/search/trends wrappers) as tools.
  2. `decide_followup` uses strict JSON output (`{"follow_up_query": str | null}`), max 1 query, no loop. Parse with retry ≤2, default to null on failure.
  3. `synthesize` is a single LLM call with evidence list in-context; no tool use in that node.
  4. Set per-node timeout 15s + `max_retries=2` on the ChatDeepSeek client.
- **Config shape (`research_desk/config.py`):**
  ```python
  MODEL_CONFIG = {
    "decide_followup": {"provider": "deepseek", "model": "deepseek-chat", "temperature": 0},
    "synthesize": {"provider": "deepseek", "model": "deepseek-chat", "temperature": 0.2},
  }
  SEARCH_BUDGET = {"news": 10, "trends": 1, "web_search": 5}  # result counts, aligns with SerpApi quota
  TIMEOUT_S = 15
  ```
- **Acceptance:** `graph.stream()` runs end-to-end on stubs without keys; with keys, Hero-1 "why is Brent moving?" produces a cited report + trace events `{stage, status, query, engine, result_count, timestamp}` over `WS /ws/research/{session_id}`.

# Research Desk — fixed-pipeline LangGraph agent + DeepSeek (Hermes retired)

Stages: `resolve → market_pull → news_search → trends_search → decide_followup
→ [web_search?] → physical_corroborate → synthesize`.
Only `decide_followup` makes an agentic choice (0/1 follow-up query, strict JSON);
everything else is a fixed edge. Only `decide_followup` + `synthesize` touch the
model (`ChatDeepSeek`, `DEEPSEEK_API_KEY`, cloud inference only).

- `market_pull` / `physical_corroborate` call `backend/services/*` in-process.
- Only `tools/serpapi_tool.py` is injected as tools (no Tavily default).
- Without `DEEPSEEK_API_KEY`, LLM nodes stub (follow-up → None, synthesis →
  template report) so `graph.stream()` runs end-to-end keyless against
  `MOCK_MODE=true` warm cache.
- Frontend: `WS /ws/research/{session_id}` streams `{stage, status, query,
  engine, result_count, timestamp}` → narration + search-trace panel;
  `POST /api/research/run` for the blocking run.

# TEAM START HERE — Execution Roadmap (push-ready)

Read order: this file → `final_mvp.md` → `api_implementation_plan.md` → `agentic_implementation_plan.md` → `apis_aaj.md` (reference only).

## 0. What we are building (one spine)

```text
Brent moves → Market Home flags → Asset verdict → WHY? → Research Desk
→ Hormuz map (count vs 7d baseline) → Cross-market exposures → cited report
```

If a task doesn't serve this spine, it waits until the Day 10–12 checkpoint.

## 1. Setup (everyone, Day 1)

```bash
python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn requests yfinance edgartools myeia langgraph langchain-deepseek
cp .env.example .env   # fill keys below; never commit .env
python scripts/warm_cache.py  # after backend skeleton exists
```

`.env` keys: `SERPAPI_KEY_1..N, ALPHAVANTAGE_API_KEY, FRED_API_KEY, AISSTREAM_API_KEY, EIA_API_KEY(optional), SEC_USER_AGENT, DEEPSEEK_API_KEY, MOCK_MODE`.

Quotas to respect: SerpApi 250/mo + 50/hr (cache-first, warm cache before recording); AV 25/day (yfinance fallback); SEC 10/sec; FRED 120/min; AISStream 3 conns, bbox only, server-side.

## 2. Workstreams (3 people, parallel after Task A)

- [ ] **Task A — Primitives (1 person, Day 1–2, blocks all).** `models/source_record.py` + `cache/cache.py::get_or_fetch` + `config.py` + `providers/serpapi.py::SerpApiKeyPool` + `main.py` skeleton + `api/routes.py` + `GET /healthz /readyz`. Done = routes return stub SourceRecords with cache headers.
- [ ] **Task B — Markets (1 person, Day 2–5).** `alphavantage.py` + `yfinance_provider.py` + `fred.py` (≤6 series in `fred_watchlist.json`) + `sec.py` (2 fns: filings/insider) + `market_home_service` + `asset_service` + curated `tickers.json`. Done = `GET /api/market-home`, `GET /api/asset/{ticker}` live with Physical-vs-Narrative + filings links.
- [ ] **Task C — Events/Matrix/Map-static (1 person, Day 2–6).** `events_service` (news cluster + `event_chain.json`) + `cross_market_service` (`sensitivity_matrix.json` + `simulate`) + map base (MapLibre+OpenFreeMap) + `chokepoints.json`. Done = Events + Cross-Market + static map render.
- [ ] **Task D — Live map (whoever frees first, Day 5–8).** `aisstream.py` + `hormuz.db` (schema in API plan §9) + `seed_baseline.json` + `map_service.get_hormuz()` + `WS /ws/map/hormuz` throttled + `scripts/warm_cache.py`. Done = count vs 7d baseline renders; socket-kill test still renders from seed (`stale:true`).
- [ ] **Task E — Research Desk (1 person, Day 5–11, needs A+B).** Fork `open_deep_research`; strip Tavily; inject `serpapi_tool.py`; DeepSeek-only `decide_followup` (strict JSON, ≤1 query) + `synthesize`; reuse services for `market_pull`/`physical_corroborate`; `eia.py` (1 fn, skippable) here; `WS /ws/research/{id}` trace. Done = Hero-1ŝ cited report end-to-end.
- [ ] **Task F — Polish only if A–E demo-clean (Day 11+).** Anomaly strip, scenario slider, rising-queries badge, geo strip, autocomplete panel, command palette, evidence hover cards, `MOCK_MODE=true` recording.

## 3. API contract (frozen for frontend)

```text
GET /api/market-home | GET /api/asset/{ticker} | GET /api/events
GET /api/events/{id}/chain | GET /api/cross-market
POST /api/cross-market/simulate {shock_asset, shock_value}
GET /api/map/hormuz → {count, baseline_7d, pct_change, positions[], retrieved_at, stale}
WS /ws/map/hormuz | WS /ws/research/{session_id} → {stage,status,query,engine,result_count,timestamp}
```

Every number carries `{value, source, observed_at, retrieved_at}`. Every AI claim links to `SourceRecord`s.

## 4. Demo-safety rules (non-negotiable)

1. 15s timeout per node/route → `{status:"skipped"}` never hang.
2. Map works with AIS killed (seed fallback). Test by killing socket weekly.
3. Judged run = one SerpApi key + warm cache. Rotation is dev-only.
4. Record video with `MOCK_MODE=true` (zero quota burn).
5. Start AIS logging Day 1 — baseline needs real days by demo week.

## 5. Checkpoints

- **Day 2:** Task A merged, all can run `uvicorn backend.main:app` + `/healthz`.
- **Day 6:** Home + Asset + Events + Matrix walkable without map/agent.
- **Day 10–12:** Full Hero-1 live. If not demo-clean, cut Task F before touching spine.
- **Submit:** repo (code+README architecture+SerpApi explanation+env+demo steps) + <3min video (product working, SerpApi trace visible) + written SerpApi engine justification.

## 6. Git workflow

`main` (demo-clean only) ← `feat/<task>` PRs, one reviewer, squash merge. `warm_cache.json`/`hormuz.db` git-ignored; `seed_baseline.json` committed.

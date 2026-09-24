# Frontend Contract (verified live 2026-09-24, E2E ALL PASS)

Base: FastAPI `backend/main.py`. Mount order: `/api/*` + WS research/map, then
`/healthz`, `/readyz`, static `frontend/` last (only if dir exists; currently absent).
CORS `*`. Every payload carries `evidence[]` (SourceRecords) and honest flags:
`stale:true` = seed fallback, `status:skipped` = provider down, never fake values.

- `GET /healthz` → `{"ok": true}`
- `GET /readyz` → `{"db_exists","cache_size","ais_task"}`
- `GET /api/market-home` → `{indices{SPX,NDX}, fx{EURUSD,USDINR}, rates(DGS10→AV TNX fallback),
  commodities{BRENT,WTI,GOLD,COPPER,NATGAS}, crypto{BTC,ETH}, event_ticker[8], anomaly_strip, evidence[]}`
  Price fallbacks: AV → yfinance live (works when AV 25/day quota exhausted).
- `GET /api/asset/{ticker}` → `{ticker, quote, chart{rows,tail}, fundamentals,
  filings[3], insider[5] (SEC live for equities; non-equity → skipped, not crash),
  news_timeline, trends, physical_vs_narrative{price_delta_pct,physical_delta_pct,verdict},
  rising_queries_badge[:5], regional_interest_strip[:5], what_people_are_asking,
  physical_corroboration, evidence[]}`
- `GET /api/events?q&num` → `{clusters[], count, what_people_are_asking, evidence[]}`
  (empty clusters in mock honestly; live returns clusters)
- `GET /api/events/{id}/chain` → `{event_id, category, commodity, sectors[], companies[]}`
- `GET /api/cross-market` → `{matrix{BRENT,WTI,NATGAS}, candidate_edges[dashed SerpApi, wire engine google], evidence[]}`
- `POST /api/cross-market/simulate {shock_asset, shock_value}` →
  `{shock_asset, shock_value, exposures[{target,exposure,weight}], exposed_chokepoints[hormuz,...]}`
- `GET /api/map` → 5 boxes `[{id,name,bbox,count,baseline_7d,pct_change,positions[],retrieved_at,stale,evidence[]}]`
  Rule: seed counts ONLY with `stale:true`. UI must badge stale.
- `GET /api/map/{id}` → one box; `GET /api/map/{id}/history?hours` → `{counts[], crossings[], stale}`
- `GET /api/search?q&limit` → `{query, results[{label,type,route}]}` (curated index, no fetch)
- `GET /api/geo/{ports,routes,tss_lanes,trade_arcs}` → GeoJSON / `{type:ArcCollection, arcs[]}`
- `GET /api/map/layers/{weather,earthquakes,disasters}` → `{feed, dots[]|alerts[], evidence[]}`
- `WS /ws/map/{id}` → first `{"type":"snapshot","data":box}`, then `0.5s` diffs
  `{added[], updated[{mmsi,lat,lon,sog,cog}], removed[], count, pct_change, stale}` (cap 2000)
- `POST /api/research/run {query}` → `{report (Groq qwen/qwen3.8-27b, max 800 tokens), trace[7-8 stages], evidence_count}`
  Never stub when `LLM_API_KEY` set. Low confidence + contradicting section when data thin.
- `WS /ws/research/{session}` → send `{"query":...}`, receive per-node
  `{session,node,label,stage,status,query?,engine?,result_count?,timestamp}`, then `{final:true, report, evidence_count}`
  Single graph run (no double invoke).

DB `backend/data/chokepoints.db` (SQLite): `chokepoint(5 rows)`, `traffic_hour`,
`positions_cache`, `crossing_hour`. Baseline = 7d AVG else seed + `stale:true`.
`warm_cache.json` absent until AV quota reset; replay then serves zero-quota demo.
Env: `LLM_API_KEY` = groq key (canonical, `GROQ_API_KEY` alias, `LLM_MODEL` override);
`MOCK_MODE=true` replay / `false` live. Never commit `.env`.

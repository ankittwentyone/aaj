# API / Deterministic Layer — Implementation Plan (Claude Code handoff)

Scope: everything needed to serve Market Home, Asset/Company, Events, Cross-Market Matrix, and Map — per `final_mvp.md`. No agent logic lives here; this is pure fetch → normalize → cache → serve.

---

## 1. Directory structure

```
backend/
  models/
    source_record.py        # normalized envelope (see §2)
  providers/
    serpapi.py               # google_news, google_trends, google_search
    alphavantage.py
    yfinance_provider.py
    sec.py
    fred.py
    aisstream.py
  cache/
    cache.py                 # generic get_or_fetch(key, ttl, fetch_fn)
  services/
    market_home_service.py
    asset_service.py
    events_service.py
    cross_market_service.py
    map_service.py
  api/
    routes_market.py
    routes_asset.py
    routes_events.py
    routes_crossmarket.py
    routes_map.py
  config.py                  # env vars, SerpApi key-rotation pool
  main.py                    # app entrypoint, route registration
```

## 2. Normalized record (unchanged from apis_aaj.md §29 — implement first, everything depends on it)

```python
class SourceRecord(TypedDict):
    provider: str
    dataset: str
    entity_id: str | None
    observed_at: str | None
    retrieved_at: str
    source_url: str | None
    query: str | None
    payload: dict            # provider-specific payload
    confidence: float | None
```

Every provider function returns `SourceRecord | list[SourceRecord]`. Services never touch raw provider responses directly.

## 3. Cache layer — build second

```python
def get_or_fetch(key: str, ttl_seconds: int, fetch_fn: Callable) -> Any
```

Key = `f"{provider}:{dataset}:{normalized_params}:{time_bucket(ttl_seconds)}"`. Backing store: in-memory dict + optional SQLite/Redis if time allows — in-memory with a background sweep is enough for a demo.

TTL table (from apis_aaj.md, keep as-is):

| dataset class | TTL |
|---|---|
| static geo / chokepoint markers | days |
| historical price series | long (hours+) |
| macro (FRED) | hours |
| SerpApi news | minutes |
| SerpApi trends | hours |
| SerpApi search (research) | per query/time-bucket |
| AIS latest position | seconds–minutes |

## 4. Providers — build in this order

### 4a. SerpApi (`providers/serpapi.py`) — build first, everything else can stub

```python
def google_news(query: str, num: int = 10) -> list[SourceRecord]
def google_trends(query: str, geo: str | None = None) -> SourceRecord
def google_search(query: str, num: int = 5) -> list[SourceRecord]
def google_autocomplete(query: str) -> SourceRecord
```

`google_trends`'s payload should retain the full raw response, not just the interest score — `rising_queries` and the regional `geo` breakdown are both already in that response and cost nothing extra to keep. Don't discard them at the provider layer; let the service layer decide what to surface.

Wrap all four in a `SerpApiKeyPool`:

```python
class SerpApiKeyPool:
    def __init__(self, keys: list[str]): ...
    def call(self, engine: str, params: dict) -> dict:
        # round-robin; on 429/quota error, advance to next key and retry once
```

Env: `SERPAPI_KEY_1..N`. Every call goes through the cache layer first.

### 4b. Alpha Vantage + yfinance (`providers/alphavantage.py`, `providers/yfinance_provider.py`)

Functions needed for MVP:
```python
def quote(ticker: str) -> SourceRecord
def historical(ticker: str, range_: str) -> SourceRecord
def fundamentals(ticker: str) -> SourceRecord
def fx_rate(pair: str) -> SourceRecord
def commodity(name: str) -> SourceRecord   # Brent, WTI, Gold, Copper, Nat Gas
```
Alpha Vantage primary (has an explicit contract); yfinance as fallback/secondary if AV rate-limited. Don't build two live paths for the same field unless the primary actually breaks in testing.

### 4c. SEC (`providers/sec.py`) — only if time allows past Phase 2 checkpoint; not required for Hero-1 demo path, cut first if behind.

### 4d. FRED (`providers/fred.py`)

```python
def series(series_id: str) -> SourceRecord   # e.g. 10Y yield, CPI
```

### 4e. AISStream (`providers/aisstream.py`) — build in Phase 5 alongside map service

```python
def subscribe_hormuz(on_message: Callable) -> None   # websocket, bounding box only
def latest_snapshot() -> SourceRecord                 # cached in-memory positions
def traffic_anomaly() -> SourceRecord                  # count vs 7d rolling baseline
```
Start logging Hormuz traffic the day this goes live — you need real days of data to have a real baseline by demo week, not a placeholder.

## 5. Services — one per screen, compose providers + curated static data

- `market_home_service.get_home()` → indices/FX/rates/commodities/crypto (AV/yfinance) + movers + event ticker (SerpApi news, top N) + **anomaly strip** (combines price delta + news volume delta + trends delta + Hormuz anomaly — all already computed elsewhere, this just aggregates)
- `asset_service.get_asset(ticker)` → quote/chart/fundamentals (AV) + news timeline (SerpApi news) + **Physical-vs-Narrative panel** (price delta vs attention delta vs physical signal delta — simple normalized comparison, not an LLM call) + **rising-queries badge** and **regional interest strip** (both pulled straight off the same `google_trends` call the panel already makes — no new fetch) + **"what people are asking" panel** (`google_autocomplete`, one new cached call per asset)
- `events_service.get_events()` → SerpApi news, clustered by simple similarity/topic grouping; `get_event_chain(event_id)` → curated static mapping (event category → commodity → sector → company, hand-authored JSON, not discovered)
- `cross_market_service.get_matrix()` → curated static sensitivity JSON; `simulate(shock_value)` → scenario slider, just arithmetic over the static matrix
- `map_service.get_hormuz()` → static chokepoint markers JSON + live AIS snapshot + anomaly %; falls back to last cached snapshot if the websocket is down

## 6. Routes (FastAPI or equivalent)

```
GET  /api/market-home
GET  /api/asset/{ticker}
GET  /api/events
GET  /api/events/{event_id}/chain
GET  /api/cross-market
POST /api/cross-market/simulate       # body: {shock_asset, shock_value}
GET  /api/map/hormuz
WS   /ws/map/hormuz                   # throttled live vessel updates
```

## 7. Env vars (final list)

```
SERPAPI_KEY_1..N
ALPHAVANTAGE_API_KEY
FRED_API_KEY
AISSTREAM_API_KEY
EIA_API_KEY              (optional — eia.py skips gracefully if missing)
SEC_USER_AGENT           (required if sec.py built, e.g. "TeamName you@email.com")
DEEPSEEK_API_KEY         (agent layer only, listed here so .env is complete)
MOCK_MODE                ("true" for quota-free video recording, serves warm_cache.json)
```

## 9. Locked decisions (Sept 2026 — do not re-debate)

1. **Baseline store = SQLite (stdlib `sqlite3`, no new dep).** File: `backend/data/hormuz.db`. Tables:
   ```sql
   CREATE TABLE IF NOT EXISTS traffic_hour(
     ts TEXT PRIMARY KEY, vessel_count INT, tanker_count INT, cargo_count INT);
   CREATE TABLE IF NOT EXISTS positions_cache(
     mmsi TEXT PRIMARY KEY, lat REAL, lon REAL, type TEXT, updated_at TEXT);
   ```
   Plus bundled fallback `backend/data/seed_baseline.json` (checked in). If DB empty/corrupt/fresh deploy → serve seed + `stale:true`. `scripts/warm_cache.py` backfills DB from seed on boot. Reason: in-memory dict dies on Render/Railway restart and wipes the 7-day baseline.
2. **SEC = INCLUDE via `edgartools` (MIT, `pip install edgartools`).** No key, no quota. Only `SEC_USER_AGENT` + 10 req/sec limit. Only 2 functions (see §10). Huge credibility for Asset screen, ~1 day work.
3. **EIA = INCLUDE conditionally via `myeia` or plain `requests` (free key, email+ToS).** Only 1 function `series()` over 4 hardcoded IDs (see §10). If `EIA_API_KEY` missing → return `{"status":"skipped"}`; spine still works on AIS alone.
4. **Single FastAPI process on Render/Railway.** No Postgres, no Redis, no Celery. Background work = `asyncio` tasks in `main.py` lifespan. Frontend choice deferred.
5. **Research Desk imports `services/*` in-process** (no HTTP hop). See agentic plan §9–10.

## 10. Providers — SEC + EIA specs (locked scope)

### 10a. SEC (`providers/sec.py`) — always built
```python
def filings(ticker: str, form: str = "10-K", limit: int = 3) -> list[SourceRecord]
def insider(ticker: str, limit: int = 5) -> list[SourceRecord]  # Form 4 cluster
```
- `from edgar import Company, set_identity; set_identity(os.environ["SEC_USER_AGENT"])`
- Ticker→CIK via `Company(ticker)`; catch lookup failure → `{"status":"skipped"}`.
- Cache TTL: filings days, insider hours. Wired only into `asset_service.get_asset()` (filings links + insider badge) + optional agent corroboration. No XBRL statement parsing for MVP (AV covers fundamentals).

### 10b. EIA (`providers/eia.py`) — built with graceful skip
```python
def series(series_id: str) -> SourceRecord  # raises SkipProvider if no key
```
- MVP watchlist (`backend/data/curated/eia_watchlist.json`, 4 IDs only): crude stocks, production, refinery utilization, nat-gas storage. Resolve exact v2 routes at implementation time via API browser; record route + verification date in code comment.
- Cache TTL hours. Called only from `physical_corroborate` for Brent/NatGas queries.
- `pip install myeia` optional; plain `requests.get("https://api.eia.gov/v2/...", params={"api_key":...})` is fine.

## 11. AIS + map persistence contract

- `aisstream.py` subscribes Hormuz bbox only, server-side, exp-backoff+jitter reconnect, message-type filter.
- In-memory latest positions (per MMSI) flushed to `positions_cache` every 60s AND to `traffic_hour` once/hour.
- `map_service.get_hormuz()` returns `{count, baseline_7d, pct_change, positions[], retrieved_at, stale: bool}`. `baseline_7d = AVG(vessel_count) last 7d` from SQLite; if <24 rows → use seed file average and set `stale:true`.
- `scripts/warm_cache.py`: hits every GET once, writes `warm_cache.json` + backfills DB. `MOCK_MODE=true` serves it with zero quota burn for video recording.

## 12. Consolidated repo layout (create in this order)

```text
backend/main.py  config.py  models/source_record.py  cache/cache.py
backend/providers/serpapi.py alphavantage.py yfinance_provider.py fred.py aisstream.py sec.py eia.py
backend/services/market_home_service.py asset_service.py events_service.py cross_market_service.py map_service.py
backend/api/routes.py  (split into routes_*.py only past ~300 lines)
backend/data/curated/tickers.json chokepoints.json sensitivity_matrix.json event_chain.json fred_watchlist.json eia_watchlist.json
backend/data/hormuz.db  seed_baseline.json  warm_cache.json (generated, git-ignored except seed)
scripts/warm_cache.py
research_desk/  (see agentic plan)
```

Curated JSON schemas: `sensitivity_matrix.json` = `{shock_asset: [{target, direction: +/-1, weight: 0-1, rationale}]}`; `event_chain.json` = `{category: {commodity, sectors[], companies[]}}`; `chokepoints.json` = `[{id, name, lat, lon, live: bool}]`.

## 13. Ops checklist (Render/Railway)

- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.
- Persistent volume (if available) mounted at `backend/data/`; without it, seed fallback still passes demo.
- Health: `GET /healthz`, `GET /readyz` (checks DB file + cache size + AIS task alive).
- Never commit keys. `.env.example` lists §7+§8 vars with empty values.

## 14. Build order (matches final_mvp.md phases, more granular)

1. `source_record.py` + `cache.py` + `serpapi.py` + key pool
2. `alphavantage.py` / `yfinance_provider.py` → `market_home_service` + `asset_service` → routes → **Market Home + Asset screens live**
3. `sec.py` (2 fns) → wire filings/insider badges into Asset (cheap, do alongside 2)
4. `events_service` (clustering + curated chain JSON) → **Events screen live**
5. `cross_market_service` (static matrix + simulate) → **Cross-Market screen live**
6. `aisstream.py` + SQLite baseline + `map_service` (with seed fallback) → **Map screen live**
7. `eia.py` (1 fn, skippable) → wire into `physical_corroborate` only
8. Anomaly strip on Market Home (pulls from services already built in 2–6, no new provider work)

Everything through step 6 is required for the Hero-1 demo spine. Steps 7–8 are the first §5 "small additions" — only after 1–6 are demo-clean.

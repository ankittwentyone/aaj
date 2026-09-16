# API / Deterministic Layer — Implementation Plan (Claude Code handoff)

Scope: everything needed to serve Market Home, Asset/Company, Events, Cross-Market Matrix, and Map — per `final_mvp.md`. No agent logic lives here; this is pure fetch → normalize → cache → serve.

---

## 1. Directory structure

```
backend/
  models/
    source_record.py        # normalized envelope (see §2)
  providers/
    serpapi.py               # google_news, google_trends, google_search, google_autocomplete
    alphavantage.py
    yfinance_provider.py
    sec.py
    fred.py
    eia.py                   # skippable if no key (see §10b)
    aisstream.py             # multi-bbox manager, reads chokepoints.json only (see §4e)
  cache/
    cache.py                 # generic get_or_fetch(key, ttl, fetch_fn)
  services/
    market_home_service.py
    asset_service.py
    events_service.py
    cross_market_service.py
    map_service.py           # per-chokepoint get_map(id)/get_all_maps, never hardcodes bboxes
  api/
    routes_market.py
    routes_asset.py
    routes_events.py
    routes_crossmarket.py
    routes_map.py            # GET /api/map + /api/map/{id}, WS /ws/map/{id}
  config.py                  # env vars, SerpApi key-rotation pool
  main.py                    # app entrypoint, route registration, AIS lifespan task
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

Key = `f"{provider}:{dataset}:{normalized_params}:{time_bucket(ttl_seconds)}"`. Backing store: in-memory dict for API responses (background sweep) + SQLite `backend/data/chokepoints.db` for AIS traffic history (see §9/§11). No Redis/Postgres. In-memory alone is NOT enough — it wipes the 7-day baseline on Render/Railway restart.

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

### 4e. AISStream (`providers/aisstream.py`) — multi-bbox manager, build in Phase 5 alongside map service

> Nothing hardcoded: bboxes come ONLY from `backend/data/curated/chokepoints.json` (`{id, name, bbox, live, commodity_tags}`). Code never contains coordinates.

```python
def load_chokepoints() -> list[dict]          # reads chokepoints.json, filters live:true
def run_ais_manager(on_update: Callable) -> None   # ONE connection, all live bboxes in one BoundingBoxes array
def latest_snapshot(chokepoint_id: str) -> SourceRecord        # in-mem positions for one box
def traffic_anomaly(chokepoint_id: str) -> SourceRecord        # count vs 7d baseline from chokepoints.db
def most_anomalous() -> SourceRecord          # max |pct_change| across live boxes (drives anomaly strip + agent)
```

Rules: server-side only, `FilterMessageTypes=[PositionReport, ShipStaticData]`, permessage-deflate on, exp-backoff+jitter reconnect, resend replaces subscription (≤1 update/sec), per-MMSI dedup 220ms, batch diff 500ms–3s. Single connection keeps the 3-conn/account+IP budget free.
Start logging all 5 boxes the day this goes live — you need real days of data to have a real baseline by demo week, not a placeholder.

## 5. Services — one per screen, compose providers + curated static data

- `market_home_service.get_home()` → indices/FX/rates/commodities/crypto (AV/yfinance) + movers + event ticker (SerpApi news, top N) + **anomaly strip** (combines price delta + news volume delta + trends delta + max chokepoint anomaly via `most_anomalous()` — all already computed elsewhere, this just aggregates)
- `asset_service.get_asset(ticker)` → quote/chart/fundamentals (AV) + filings/insider (SEC) + news timeline (SerpApi news) + **Physical-vs-Narrative panel** (price delta vs attention delta vs physical signal delta — simple normalized comparison, not an LLM call) + **rising-queries badge** and **regional interest strip** (both pulled straight off the same `google_trends` call the panel already makes — no new fetch) + **"what people are asking" panel** (`google_autocomplete`, one new cached call per asset)
- `events_service.get_events()` → SerpApi news, clustered by simple similarity/topic grouping (each cluster carries optional `chokepoint_ids` + lat/lon for the map event overlay); `get_event_chain(event_id)` → curated static mapping (event category → commodity → sector → company, hand-authored JSON, not discovered)
- `cross_market_service.get_matrix()` → curated static sensitivity JSON (solid edges) + SerpApi-discovered dashed candidate edges; `simulate(shock_value)` → scenario slider, just arithmetic over the static matrix, also returns `exposed_chokepoints` for the map highlight
- `map_service.get_map(chokepoint_id)` → bbox config + live AIS snapshot + anomaly % for ONE box; `get_all_maps()` → all 5 for the map screen + anomaly strip; falls back to per-chokepoint seed snapshot if the websocket is down

## 6. Routes (FastAPI or equivalent)

```
GET  /api/market-home
GET  /api/asset/{ticker}
GET  /api/events
GET  /api/events/{event_id}/chain
GET  /api/cross-market
POST /api/cross-market/simulate       # body: {shock_asset, shock_value} → {exposures[], exposed_chokepoints[]}
GET  /api/map                          # all chokepoints: [{id, count, baseline_7d, pct_change, retrieved_at, stale}]
GET  /api/map/{chokepoint_id}          # one box: {count, baseline_7d, pct_change, positions[], retrieved_at, stale}
WS   /ws/map/{chokepoint_id}           # throttled live vessel diffs (2/sec, delta-only, cap ~2000/box)
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

1. **Baseline store = SQLite (stdlib `sqlite3`, no new dep).** File: `backend/data/chokepoints.db` (NOTHING named after one chokepoint). Tables:
   ```sql
   CREATE TABLE IF NOT EXISTS chokepoint(id TEXT PRIMARY KEY, name TEXT, bbox TEXT, live INT);
   CREATE TABLE IF NOT EXISTS traffic_hour(
     chokepoint_id TEXT, ts TEXT,
     vessel_count INT, tanker_count INT, cargo_count INT,
     PRIMARY KEY(chokepoint_id, ts));
   CREATE TABLE IF NOT EXISTS positions_cache(
     chokepoint_id TEXT, mmsi TEXT, lat REAL, lon REAL, sog REAL, cog REAL, type TEXT, updated_at TEXT,
     PRIMARY KEY(chokepoint_id, mmsi));
   ```
   Plus bundled fallback `backend/data/seed_baseline.json` keyed per chokepoint `{id: {baseline_7d, sample_positions}}` (checked in). If DB empty/corrupt/fresh deploy → serve seed + `stale:true` per box. `scripts/warm_cache.py` backfills DB from seed on boot. Reason: in-memory dict dies on Render/Railway restart and wipes the 7-day baseline.
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

## 11. AIS + map persistence contract (per chokepoint, config-driven)

- `aisstream.py` reads live bboxes ONLY from `chokepoints.json`; single server-side connection, exp-backoff+jitter reconnect, message-type filter.
- In-memory latest positions (per chokepoint+MMSI) flushed to `positions_cache` every 60s AND to `traffic_hour` once/hour per box.
- `map_service.get_map(id)` returns `{count, baseline_7d, pct_change, positions[], retrieved_at, stale: bool}`. `baseline_7d = AVG(vessel_count) last 7d WHERE chokepoint_id=id`; if <24 rows → use that box's seed average and set `stale:true`. `most_anomalous()` returns the box with max |pct_change|.
- `scripts/warm_cache.py`: hits every GET (including all 5 map boxes) once, writes `warm_cache.json` + backfills DB. `MOCK_MODE=true` serves it with zero quota burn for video recording.
- `scripts/prep_geo.py` (one-time): builds committed static layers — `ports.geojson`, `routes.geojson` (OurAirports+OpenFlights), `tss_lanes.geojson`, Overture extract — so map panning never touches a live provider.

## 12. Consolidated repo layout (create in this order)

```text
backend/main.py  config.py  models/source_record.py  cache/cache.py
backend/providers/serpapi.py alphavantage.py yfinance_provider.py fred.py aisstream.py sec.py eia.py
backend/services/market_home_service.py asset_service.py events_service.py cross_market_service.py map_service.py
backend/api/routes.py  (split into routes_*.py only past ~300 lines)
backend/data/curated/tickers.json chokepoints.json sensitivity_matrix.json event_chain.json fred_watchlist.json eia_watchlist.json
backend/data/geo/ports.geojson routes.geojson tss_lanes.geojson  (committed, built by prep_geo.py)
backend/data/chokepoints.db  seed_baseline.json  warm_cache.json (generated except seed; db+warm git-ignored)
scripts/warm_cache.py  scripts/prep_geo.py
research_desk/  (see agentic plan)
```

Curated JSON schemas (only sources of truth — code reads, never hardcodes):
- `tickers.json` = `{display: {av_symbol, yf_symbol}}` (all symbols here, none in code)
- `fred_watchlist.json` / `eia_watchlist.json` = `[{id, label, route}]` (all series IDs here)
- `sensitivity_matrix.json` = `{shock_asset: [{target, direction: +/-1, weight: 0-1, rationale}]}`
- `event_chain.json` = `{category: {commodity, sectors[], companies[]}}`
- `chokepoints.json` = `[{id, name, bbox: [[lat,lon],[lat,lon]], live: bool, commodity_tags: []}]` (all coordinates here)

## 15. Peak map rendering spec (frontend, no new backend routes)

- Stack: MapLibre GL JS + `@deck.gl/maplibre` `MapLibreOverlay (interleaved:true)` on Carto Dark Matter (+Seamap/Seascape nautical style).
- Layers off the SAME `GET /api/map[/{id}]` + `WS /ws/map/{id}` data: `ScatterplotLayer` dots (tanker/cargo/other) + glow ring + `TripsLayer` 4-min trails + `PathLayer` heading stubs (len ∝ SOG) + `ArcLayer` trade arcs + event dots + crossings mini-chart + 30-day playback. Canvas only, viewport culling, dead-reckoning between pings.
- Scenario highlight: `POST /simulate → exposed_chokepoints[]` drives map emphasis. No extra fetch.

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
6. `aisstream.py` (multi-bbox manager) + SQLite per-chokepoint baseline + `map_service` (with per-box seed fallback) + `prep_geo.py` static layers → **Map screen live**
7. `eia.py` (1 fn, skippable) → wire into `physical_corroborate` only
8. Anomaly strip on Market Home (uses `most_anomalous()`, no new provider work)

Everything through step 6 is required for the Hero-1 demo spine. Steps 7–8 are the first §5 "small additions" — only after 1–6 are demo-clean.

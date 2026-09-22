# API / DATA SOURCE PLAN

> **Purpose:** Codex/developer handoff for the Market Intelligence Terminal.
>
> **Goal:** maximum hackathon impact with a small team, maximum free/open data, minimal provider sprawl, and selective high-value SerpApi usage.
>
> **Hackathon rule:** SerpApi must be meaningfully used, not added cosmetically. We therefore use it primarily for web intelligence, discovery, attention, corroboration and research; deterministic numbers should come from structured/free sources where possible.

---

# 0. PRODUCT DATA PRINCIPLE

Think in four data layers:

```text
STRUCTURED MARKET DATA
    "What is happening?"
    -> Alpha Vantage / yfinance / FRED / EIA / CFTC

PHYSICAL WORLD
    "What is happening in reality?"
    -> AISStream / OpenSky / Open-Meteo / FIRMS / USGS / OSM / Overture

WEB / NARRATIVE
    "Why? What changed? What is emerging?"
    -> SerpApi

EXPECTATIONS
    "What is the market pricing in / believing?"
    -> Polymarket (+ options/positioning where available)
```

Do **not** create multiple providers for the same job unless the second provider is explicitly used for corroboration/fallback.

---

# 1. FINAL PRIORITY SYSTEM

## P0 — BUILD

These directly support the MVP and should be integrated first.

```text
1. SerpApi
2. Alpha Vantage
3. yfinance
4. SEC EDGAR + edgartools
5. FRED
6. AISStream
7. Open-Meteo
8. OpenStreetMap + Overpass / preloaded OSM extracts
9. Overture Maps
10. OpenSky
11. Polymarket
12. CFTC COT
13. NASA FIRMS
14. USGS Earthquake API
15. RBI + MoSPI/eSankhyiki
16. Natural Earth
```

## P1 — ADD WHEN THE CORE IS STABLE

```text
17. EIA
18. UN Comtrade
19. OurAirports
20. OpenFlights
21. GDACS
22. OpenInfraMap / OSM infrastructure data
23. GLEIF
24. CoinGecko
25. NOAA/NHC
```

## P2 — STRETCH / ONLY IF A SCREEN NEEDS IT

```text
26. Google Shopping (through SerpApi)
27. Google Jobs (through SerpApi)
28. Google Patents (through SerpApi)
29. Google Maps (through SerpApi, only for verification/enrichment)
30. GDELT
31. World Bank / IMF / OECD
32. WTO / WITS
33. FAOSTAT / USDA
34. Electricity Maps
35. NASA EONET
36. GeoNames
37. GADM
38. Overture bridge/GERS expansion
```

## DO NOT START WITH

```text
MarineTraffic paid API
commercial freight APIs
commercial satellite feeds
social/X scraping
full global supply-chain databases
Kafka / Airflow / data lake infrastructure
large portfolio-optimization stacks
```

---

# 2. COST / ACCESS SUMMARY

| Provider | Cost expectation | Key/Auth | Freshness | Main use |
|---|---|---|---|---|
| SerpApi | **Free: 250 searches/month, 50/hour**; Starter currently $25/mo for 1,000 if needed | key | live/on-demand | web/news/trends/research |
| Alpha Vantage | **25 requests/day default; verified open-source/educational projects may receive unlimited API access** | key | endpoint-dependent | financial data |
| yfinance | free library; unofficial Yahoo access; no paid API subscription | none | endpoint-dependent | markets/history/options |
| SEC EDGAR | free | none for public data | minutes / throughout day | filings/XBRL/insiders |
| FRED | free | free API key | periodic | macro |
| AISStream | free stream with API key; account limits apply | key | live | ships |
| OpenSky | free for research/non-commercial; authenticated quota currently 4,000 daily credits for standard users, with other tiers | OAuth2 | live | aircraft |
| Open-Meteo | free non-commercial API, no key; current site states up to 10k daily API calls; attribution required | none | hourly/forecast | weather |
| OSM / Overpass | open data; public Overpass is shared infrastructure | none | static/query | physical map/POIs |
| Overture Maps | open downloadable/cloud datasets | none | monthly release | places/transport/base geodata |
| Polymarket | public read APIs; current docs expose generous rate limits | none for public market reads | live | prediction markets |
| CFTC COT | free public data | none | weekly | positioning |
| NASA FIRMS | free | registration/key depending access method | near-real-time | fires |
| USGS | free | none | live | earthquakes |
| RBI / MoSPI | free government data | varies | daily/monthly | India macro |
| EIA | free API access with key | key | hourly/weekly/daily depending series | energy |
| UN Comtrade | free tier exists; exact quota should be verified at implementation time | key | monthly/annual | trade flows |
| OurAirports | public domain downloads | none | regularly updated | airport metadata |
| OpenFlights | free/open datasets | none | static | route map |
| Natural Earth | public-domain geography | none | static | map base |

**Important:** quotas/licensing change. Put the verification URL beside the adapter and record the verification date in code docs.

Current verified examples:
- SerpApi free tier is 250 searches/month and 50 throughput/hour. citeturn840069search0turn840069search6
- Alpha Vantage states 25 requests/day for free stock API service and says verified open-source/educational projects can receive unlimited requests. citeturn864448search6
- SEC public APIs require no API key; SEC fair-access guidance caps scripted access at 10 requests/sec. citeturn925763search2turn925763search3
- AISStream requires server-side API-key usage and currently allows up to 3 subscribed connections per account/IP, with bounding-box filtering and message-type filters. citeturn864448search0turn864448search3
- OpenSky's current API documentation lists 4,000 daily credits for standard authenticated users and 400 for anonymous users, with 5–10 second live state resolution depending on access mode. citeturn925763search0
- Open-Meteo currently states no key/sign-up is required for its free API and up to 10,000 daily calls for non-commercial use; data is CC BY 4.0 and attribution is required. citeturn864448search5

---

# 3. SERPAPI — SPECIAL TREATMENT

## ENV

```env
SERPAPI_API_KEY=
```

Base endpoint:

```text
https://serpapi.com/search.json
```

## P0 engines

### `google_news`

**Purpose:** catalyst/event discovery.

Use for:
- market-moving headlines
- company developments
- geopolitical events
- supplier disruption
- sector narratives
- event timelines

### `google_search`

**Purpose:** context + verification + deep research.

Use for:
- `site:` targeted primary-source searches
- company/supplier discovery
- finding government/company pages
- corroborating events
- discovering relationships not present in structured data

### `google_trends`

**Purpose:** attention / demand / narrative-change signal.

Use for:
- attention vs price
- regional interest
- related-query breakouts
- emerging narratives

Never treat Trends' 0–100 scale as globally comparable across independent requests without normalization.

### `google_autocomplete`

**Purpose:** early question/narrative discovery.

Use sparingly for:
- “what are people starting to ask?”
- emerging query terms

## P1 SerpApi engines

### `google_shopping`

Use for:
- product-price baskets
- consumer demand proxies
- commodity/product price examples

### `google_jobs`

Use for:
- hiring velocity
- expansion/layoff divergence

### `google_patents`

Use for:
- innovation / R&D signal
- technology/company comparisons

### `google_maps`

Use primarily for:
- company/site verification
- physical footprint enrichment

### `google_finance`

Use as a corroboration/context source rather than primary financial storage.

## Do NOT build every SerpApi engine

Avoid quota burn on engines that do not produce a clear product outcome.

## SerpApi budget strategy

Free quota is pooled. Target an internal allocation roughly like:

```text
google_news        100
 google_search       70
 google_trends       50
 google_finance      15
 google_autocomplete 10
 other               5
-----------------------
TOTAL              250
```

This is a **planning budget**, not an API-enforced allocation.

Cache by:

```text
engine + normalized parameters + time bucket
```

Do not allow every UI refresh to make a fresh search.

For research runs, use a bounded number of search operations and reuse cached evidence.

Official docs:
- https://serpapi.com/search-api
- https://serpapi.com/google-news-api
- https://serpapi.com/google-trends-api
- https://serpapi.com/google-finance-api

---

# 4. ALPHA VANTAGE

## ENV

```env
ALPHAVANTAGE_API_KEY=
```

Base:

```text
https://www.alphavantage.co/query
```

## Use

Primary structured source for:

```text
quotes
historical series
fundamentals
earnings
options
insiders
institutional holdings
news/sentiment
FX
crypto
commodities
economic indicators
technical indicators
```

Do not use it for exchange-grade realtime claims unless the specific endpoint/license supports that level of freshness.

### Optional existing integration
Alpha Vantage currently advertises an official MCP server; evaluate this later if it reduces agent-tool work. citeturn864448search6

---

# 5. YFINANCE

Package:

```text
pip install yfinance
```

Use as convenience/secondary market source:

```text
history
quotes
ETFs
FX
futures
options chains
earnings dates
insiders / holders where exposed
```

Rules:
- do not assume contractual SLA
- cache historical data
- label freshness
- use Alpha Vantage as the more explicit API contract where appropriate

---

# 6. SEC EDGAR + EDGARTOOLS

## Public SEC endpoints

```text
data.sec.gov
www.sec.gov/Archives/edgar/data/...
```

No API key for public submission/XBRL data. Current SEC guidance says public access is limited to 10 requests/sec and requires a declared user-agent. Filings are often available within minutes of the EDGAR timestamp. citeturn925763search2turn925763search3turn925763search9

## Python

Prefer:

```text
edgartools
```

Use for:

```text
8-K
10-Q
10-K
Form 4
13F
XBRL facts
filing metadata
```

This is primary evidence and should be high-priority for company research.

---

# 7. FRED

## ENV

```env
FRED_API_KEY=
```

Use for selected macro series only:

```text
CPI
PCE
unemployment
GDP
rates
yield curves
credit / financial conditions
```

Current documentation says 120 requests/minute before 429 throttling. citeturn864448search4

Don't ingest every FRED series. Curate a small macro watchlist.

---

# 8. RBI + MOSPI — INDIA LENS

Primary India sources.

Use for:

```text
RBI policy/rates
FX reference data
money/monetary indicators
GDP
CPI
WPI
IIP
PLFS
trade / economic indicators where exposed
```

This is disproportionately valuable because the hackathon is India-focused.

Implementation rule: prefer the official dataset/API over scraping third-party mirrors.

---

# 9. EIA — PHYSICAL ENERGY

## ENV

```env
EIA_API_KEY=
```

Use only high-value series:

```text
crude inventories
production
imports/exports
refinery utilization
natural gas storage
power demand / generation where useful
```

Primary purpose:

```text
PRICE MOVE
   vs
PHYSICAL FUNDAMENTALS
```

Do not build a giant energy data warehouse.

---

# 10. AISSTREAM — SHIPS / LOGISTICS MAP

## ENV

```env
AISSTREAM_API_KEY=
```

WebSocket:

```text
wss://stream.aisstream.io/v0/stream
```

Current API requires server-side keys and supports bounding-box and MMSI/message-type filtering. Current limits include 3 subscribed connections/account and 3/IP, max 200 MMSIs per subscription. citeturn864448search0

## Important product decision

Do **not** try to ingest all ships.

Curate:

```text
Hormuz
Bab el-Mandeb
Suez
Malacca
Panama
Cape of Good Hope
```

Track enough traffic to create:

```text
ship dots
vessel-type distribution
chokepoint traffic count
direction
speed
anomaly / WoW change
```

Shipping can be partly visual/cosmetic. It does not need to become a world-class maritime intelligence platform.

### Backend requirements

- server-side connection only
- reconnect with exponential backoff + jitter
- bounding boxes only
- filter message types
- maintain latest state in Redis/memory
- persist only data needed for derived metrics/demo history

AISStream explicitly says browser/direct-client connections are not permitted. citeturn864448search0

---

# 11. OPENSTREETMAP + OVERPASS

## Purpose

OSM is the **static physical-world map database**.

Useful objects:

```text
ports
airports
refineries
power plants
pipelines
rail
industrial sites
warehouses
roads
facilities
```

## Preferred workflow

```text
ONE-TIME / OCCASIONAL INGEST
Overpass or regional extract
        ↓
normalize
        ↓
local GeoJSON / Parquet
        ↓
serve to frontend
```

Do NOT call Overpass on every map interaction.

Public Overpass is shared infrastructure. Current OSM guidance notes a broad safety margin of <10,000 requests/day and <1 GB/day for the main instance, but recommends regional extracts/self-hosting for heavier workloads. citeturn864448search2turn864448search7

For larger regional preprocessing use:

```text
Geofabrik regional .pbf
osmium
DuckDB
```

### License

OSM data is ODbL. Include attribution and verify redistribution requirements before packaging derivative datasets.

---

# 12. OVERTURE MAPS

Use as the **large-scale structured geo companion to OSM**.

Current catalog includes:

```text
Places
Transportation
Divisions
Base
GERS registry
bridge files
```

Data is available as GeoParquet through S3/Azure and can be queried directly from Python/DuckDB. Overture's current docs specifically describe DuckDB/Python as common access paths. citeturn864448search8turn864448search9

## Use it for

```text
stable place/entity records
transportation geometry
large map layers
entity normalization
joining physical places across datasets
```

### GERS

Use GERS only where it materially helps entity matching. Don't build a giant entity-resolution project.

---

# 13. NATURAL EARTH

Public-domain map layers.

Use for:

```text
country borders
coastlines
rivers
physical geography
```

Purpose: clean world basemap / choropleths.

Static package into the repo or public object storage.

---

# 14. OPEN SKY — AVIATION

Base:

```text
https://opensky-network.org/api
```

Current API requires OAuth2 for authenticated access. Standard authenticated users currently receive 4,000 credits/day per endpoint bucket; anonymous users receive 400/day. citeturn925763search0

Use only for:

```text
live aircraft layer
airport activity proxy
route/disruption visualizations
selected hub activity
```

Important: OpenSky says it provides live airspace/ADS-B information and does **not** provide commercial flight schedule/delay data as such. citeturn925763search10

Do not build an airline booking/status product around it.

---

# 15. OUR AIRPORTS + OPENFLIGHTS

## OurAirports

Use for:

```text
airport metadata
coordinates
runways
airport types
```

Data is public domain. Current downloads are updated regularly. citeturn864448search1

## OpenFlights

Use for:

```text
airline routes
airline metadata
airport codes
```

Purpose: create attractive route-network visuals, not commercial flight data.

---

# 16. OPEN-METEO

No-key weather API.

Use for:

```text
weather at ports
storms
rainfall
temperature anomalies
agriculture/weather zones
energy-demand weather
India monsoon lens
```

Current site says free non-commercial use is available without key/sign-up up to 10,000 daily calls, with CC BY 4.0 attribution. citeturn864448search5

Prefer one batched request over many individual requests.

---

# 17. NATURAL EVENTS

## NASA FIRMS

Use for:

```text
wildfire hotspots
fire clusters near infrastructure
```

Map layer + event alert.

## USGS

Use for:

```text
earthquakes
magnitude
location
time
```

## GDACS

Use for:

```text
global disaster alerts
cyclones
floods
earhtquakes / multi-hazard context
```

## NOAA/NHC

Use for:

```text
hurricane/cyclone tracks
storm intensity
```

### Product rule

Natural events can be primarily **visual/demo enrichment**. Where possible, connect major events to actual nearby assets/industries rather than pretending every event is a market signal.

---

# 18. POLYMARKET

Use public market data for:

```text
event probability
probability history
volume
market discovery
```

Core question:

> **What is the market pricing in?**

Current Polymarket docs show public API rate limits substantially above what our small app requires. citeturn925763search4

Best UX:

```text
prediction probability
        +
news/event timeline
        +
asset price
```

---

# 19. CFTC COT

Use official public COT data.

Display:

```text
commercial net
non-commercial net
long/short
week-over-week change
extremes
```

Frequency: weekly.

Purpose: simple “follow the money / positioning” panel.

Do not build a full institutional positioning product.

---

# 20. UN COMTRADE — TRADE / CARGO

Use only targeted country × commodity queries.

Examples:

```text
India crude imports
China semiconductor trade
EU energy imports
India electronics imports
```

Purpose:

```text
trade dependency
origin concentration
country exposure
scenario inputs
```

Do not build a universal trade-data explorer.

Because quota details can change, verify the current registered/free tier immediately before integration.

---

# 21. COINGECKO

Only if crypto is in the visible market overview.

Use:

```text
price
market cap
volume
top movers
```

Otherwise this is lower priority than the physical-world stack.

---

# 22. GLEIF

Use only for:

```text
legal-entity identity
entity normalization
basic ownership/legal-parent graph
```

Do not attempt a global company-ownership graph from scratch.

---

# 23. OPTIONAL GLOBAL MACRO SOURCES

Use only when FRED/RBI/MoSPI do not cover a required screen:

```text
World Bank
IMF
OECD
Eurostat
BIS
```

Good for context, but they should not delay the MVP.

---

# 24. OPTIONAL AGRICULTURE SOURCES

Only if we commit to an India/weather/agriculture story:

```text
FAOSTAT
USDA NASS
Agmarknet / India OGD datasets
```

Potential chain:

```text
monsoon/weather
      ↓
production expectations
      ↓
food commodity prices
      ↓
inflation
      ↓
companies/sectors
```

This is a good India-specific stretch, not P0.

---

# 25. ELECTRICITY / INFRASTRUCTURE OPTIONALS

## Electricity Maps

Use only if we build electricity-grid analytics.

## OpenInfraMap / OSM infrastructure

Useful for visual map layers:

```text
power plants
transmission
pipelines
mines
```

Treat these primarily as geographic context unless paired with reliable operating data.

---

# 26. DATA SOURCE → PRODUCT MATRIX

| Product surface | Primary sources | Secondary / enrichment |
|---|---|---|
| Market Overview | Alpha Vantage + yfinance | SerpApi Finance |
| Equity / Company | Alpha Vantage + yfinance + SEC | SerpApi News/Search/Trends/Jobs |
| Macro | RBI + MoSPI + FRED | World Bank / IMF |
| Commodities | Alpha Vantage + EIA | CFTC + SerpApi News |
| Shipping Map | AISStream + OSM/Overture | SerpApi News |
| Ports / Infrastructure | OSM + Overture | OpenInfraMap |
| Aviation Map | OpenSky + OurAirports + OpenFlights | SerpApi Flights optionally |
| Natural Events Map | Open-Meteo + FIRMS + USGS + GDACS + NOAA | SerpApi News |
| Trade / Cargo | UN Comtrade | WTO / WITS |
| Expectations | Polymarket | SerpApi News |
| Positioning | CFTC | SEC / yfinance insiders |
| Cross-Market Graph | curated relationships + market data | SerpApi discovery of new edges |
| Alerts | market anomalies + physical events | SerpApi News/Trends |
| AI Research Desk | **SerpApi Search/News/Trends** | every structured provider as specialist tools |

---

# 27. WHAT SERPAPI SHOULD *NOT* REPLACE

Do NOT use SerpApi for:

```text
a stock-price database
macro time series
historical trade data
live AIS
live aircraft states
weather forecasts
earthquake feed
SEC filings storage
```

Use the best free structured source for those.

SerpApi wins on:

```text
narrative
discovery
web context
attention
verification
consumer web signals
finding unknown relationships
research
```

---

# 28. SOURCE PRIORITY BY WINNING VALUE

## Highest hackathon value

```text
SerpApi
AISStream
OSM + Overture
OpenSky
Open-Meteo + natural events
Alpha Vantage
SEC
Cross-market relationships
Polymarket
```

## Highest financial credibility

```text
SEC
Alpha Vantage
FRED
RBI/MoSPI
EIA
CFTC
```

## Highest visual value

```text
AISStream
OSM/Overture
OpenSky
FIRMS
USGS
NOAA
MapLibre/deck.gl data layers
```

## Highest agent/research value

```text
SerpApi Search
SerpApi News
SerpApi Trends
SEC
Alpha Vantage
FRED/EIA
AISStream-derived signals
Polymarket
```

---

# 29. NORMALIZED INTERNAL RECORDS

Every adapter should produce a consistent envelope.

```python
class SourceRecord:
    provider: str
    dataset: str
    entity_id: str | None
    observed_at: str | None
    retrieved_at: str
    source_url: str | None
    query: str | None
    payload_ref: str | None
    confidence: float | None
```

For a financial observation:

```json
{
  "provider": "alphavantage",
  "dataset": "quote",
  "entity_id": "AAPL",
  "observed_at": "...",
  "retrieved_at": "...",
  "value": 0.0,
  "unit": "USD",
  "source_url": "..."
}
```

For a web finding:

```json
{
  "provider": "serpapi",
  "dataset": "google_news",
  "entity_id": "AAPL",
  "query": "AAPL latest catalyst",
  "claim": "...",
  "source_url": "...",
  "publisher": "...",
  "published_at": "...",
  "retrieved_at": "..."
}
```

For a physical event:

```json
{
  "provider": "aisstream",
  "dataset": "position_report",
  "entity_id": "IMO/MMSI",
  "lat": 0.0,
  "lon": 0.0,
  "vessel_type": "tanker",
  "observed_at": "...",
  "retrieved_at": "..."
}
```

---

# 30. CODING RULES

## Rule 1 — One adapter per provider

```text
providers/
  serpapi.py
  alphavantage.py
  yfinance_provider.py
  sec.py
  fred.py
  eia.py
  aisstream.py
  opensky.py
  openmeteo.py
  osm.py
  overture.py
  polymarket.py
  cftc.py
  comtrade.py
  natural_events.py
```

## Rule 2 — Providers never talk directly to UI components

```text
Provider
  ↓
Normalized service
  ↓
Product feature
  ↓
API/WebSocket
  ↓
Frontend
```

## Rule 3 — Cache by provider semantics

```text
static geo             -> days/months
historical series      -> long TTL
macro                  -> hours/day
CFTC                   -> week
weather                -> 15m–1h
AIS latest state       -> seconds/minutes
news                   -> minutes
trends                 -> hours/day
SerpApi research       -> query/time-bucket cache
```

Exact TTLs should be set per product need rather than blindly globally.

## Rule 4 — Never hallucinate unavailable data

Every display should know:

```text
value
source
observed time
retrieved time
```

## Rule 5 — Maps should consume prepared data

Do not make map panning trigger expensive upstream providers.

---

# 31. FIRST IMPLEMENTATION ORDER

## Phase 1 — data foundation

```text
1. yfinance
2. Alpha Vantage
3. SerpApi News/Search/Trends
4. SEC
5. FRED
6. RBI/MoSPI
```

## Phase 2 — visual physical world

```text
7. AISStream
8. OSM/Overpass
9. Overture
10. OpenSky
11. Open-Meteo
12. FIRMS / USGS
13. Natural Earth
```

## Phase 3 — intelligence extras

```text
14. Polymarket
15. CFTC
16. EIA
17. UN Comtrade
18. OurAirports/OpenFlights
19. GLEIF/OpenInfraMap
```

## Phase 4 — SerpApi spice

Only after the core works:

```text
20. Shopping
21. Jobs
22. Patents
23. Maps
```

---

# 32. FIRST GOLDEN WORKFLOW TO TEST EVERYTHING

The first end-to-end data scenario should be:

```text
QUESTION:
Why is Brent crude moving?

MARKET
Alpha Vantage / yfinance

NEWS
SerpApi Google News

WEB CONTEXT
SerpApi Google Search

ATTENTION
SerpApi Trends

PHYSICAL ENERGY
EIA

SHIPPING
AISStream

GEOPOLITICS
SerpApi News/Search

EXPECTATIONS
Polymarket (if relevant)

OUTPUT
Price + narrative + physical confirmation + exposed sectors + evidence
```

If this works cleanly, the rest of the terminal can be built by reusing the same source adapters.

---

# 33. DO NOT FORGET

### SerpApi
**250 free searches/month / 50 per hour currently.** Budget and cache. citeturn840069search0

### Alpha Vantage
**25/day standard free access; verified open-source/educational projects can receive unlimited API access.** Confirm eligibility for this project before assuming unlimited. citeturn864448search6

### AISStream
Server-side only; bounding-box filtering; current service limits include 3 connections/account/IP and 200 MMSIs/subscription. citeturn864448search0

### OpenSky
Current standard authenticated allowance is 4,000 credits/day per endpoint bucket; do not poll globally. citeturn925763search0

### OSM
Use attribution and don't treat the public tile service as our own CDN. Prefer prepared regional data for the app.

### Overture
Use cloud GeoParquet + DuckDB for large static datasets rather than downloading the whole world. citeturn864448search8

### Evidence
Every important intelligence claim should retain provenance.

---

# 34. FINAL STACK — IF CODING TODAY

```text
CORE FINANCE
  Alpha Vantage
  yfinance
  SEC + edgartools
  FRED
  RBI + MoSPI

SERPAPI
  Google News
  Google Search
  Google Trends
  Google Autocomplete
  [Shopping / Jobs / Patents later]

PHYSICAL WORLD
  AISStream
  OpenSky
  Open-Meteo
  NASA FIRMS
  USGS
  NOAA/GDACS

GEO
  OSM + Overpass / Geofabrik
  Overture Maps
  Natural Earth
  OurAirports
  OpenFlights

MARKET EXPECTATIONS / POSITIONING
  Polymarket
  CFTC COT

COMMERCE / TRADE / ENERGY (P1)
  EIA
  UN Comtrade

OPTIONAL
  GLEIF
  OpenInfraMap
  CoinGecko
  World Bank / IMF / OECD
  FAOSTAT / USDA
  Electricity Maps
```

**This is the source universe. Do not add another API merely because it exists. Add one only when it gives a new data modality, a materially better source, or a visibly better product outcome.**

# AI-Native Market Intelligence Terminal — Product MVP

## 0. Product thesis

> **See what moved → understand the factors → see how the shock propagates → investigate it deeply.**

This is a Bloomberg-style market terminal with a strong visual **world/market layer** and a focused **AI research desk**. It is NOT an attempt to reproduce every Bloomberg function.

The product should feel like one coherent system:

**Markets → Factors → Physical World → Relationships → Research**

Agentic functionality is intentionally a layer on top, not the entire product. The main terminal remains fast, structured and visual.

---

# 1. F1 — COMMAND / MARKET HOME

### Purpose
The trader's starting point: "What matters right now?"

### Show
- Major indices: NIFTY, SENSEX, S&P 500, NASDAQ, DAX, Nikkei, Hang Seng
- FX: USD/INR, EUR/USD, USD/JPY etc.
- Rates: US 10Y, India 10Y / key RBI rates where available
- Commodities: Brent, WTI, Gold, Copper, Natural Gas
- Crypto: BTC/ETH
- Top gainers / losers / volume anomalies
- Market-moving events ticker
- Small anomaly strip
- Watchlist
- "What changed" / overnight snapshot

### Interactions
- Click any asset → Quote screen
- Click event → Event screen
- Command palette / keyboard navigation
- Search any company, ticker, commodity, country, event

### AI
Minimal: rank market events and surface notable anomalies. No full agent loop here.

---

# 2. F2 — ASSET / COMPANY INTELLIGENCE

### Purpose
One unified screen for a stock, ETF, index, commodity or other tracked asset.

### Show
- Price + multi-timeframe chart
- Volume / volatility
- Relative performance vs sector/index
- Fundamentals
- Earnings / calendar
- Options snapshot where available
- Insider / ownership information
- News timeline
- Search-interest / attention overlay
- Relevant macro factors
- Relevant commodity/physical factors
- Related companies / assets

### Hero panel: **Physical vs Narrative**

For suitable assets:

```text
PRICE       +5.4%
ATTENTION  +31%
PHYSICAL    +18%

VERDICT: MOVE SUPPORTED BY PHYSICAL + NARRATIVE SIGNALS
```

This is an analytic display, not an LLM opinion.

### Main action
`WHY IS THIS MOVING?`

This opens the Research Desk with the asset pre-loaded.

---

# 3. F3 — EVENTS / NEWS INTELLIGENCE

### Purpose
Turn raw headlines into a market-event timeline.

### Show
- Event timeline
- Headline clusters rather than duplicate headlines
- Event severity
- Timestamp
- Geography
- Affected assets/sectors
- Price reaction after the event
- Related events
- Source links

### Important interaction
Click an event:

```text
EVENT
↓
Affected commodity
↓
Affected sectors
↓
Affected companies
↓
Current market reaction
```

### SerpApi role
Primarily Google News + Google Search. Google Trends can confirm whether the event is producing unusual public attention.

---

# 4. F4 — WORLD / LOGISTICS MAP

### Purpose
Show the physical world that markets depend on.

This is allowed to be partly **visual / contextual**. It does not need to become a commercial-grade logistics product.

### Layers

#### Shipping
- Vessel positions
- Vessel type
- Major routes
- Ports
- Chokepoints
- Tankers / container ships where identifiable
- Ship destination where available
- Transit counts / simple anomaly indicators

#### Aviation
- Selected airports
- Aircraft activity / movement
- Major routes
- Disruption indicators where available

#### Natural events
- Hurricanes / tropical systems
- Earthquakes
- Wildfires
- Flood/weather anomalies
- Major storms

#### Geopolitics
- Conflict/event locations
- Sanctions / disruption locations where useful
- Major infrastructure incidents

### Geographic focus
Do NOT try to stream the entire physical planet with perfect detail.

Curate high-value areas:
- Strait of Hormuz
- Bab el-Mandeb
- Suez Canal
- Strait of Malacca
- Panama Canal
- major oil/LNG/shipping hubs
- selected airports

### UX
Clicking a ship / route / chokepoint / event should open a side panel with context.

Example:

```text
STRAIT OF HORMUZ

Tanker traffic     94
7D baseline       137
Change            -31%

Linked markets
BRENT
NAT GAS
INDIA FX
AIRLINES

Related events → 7
```

---

# 5. F5 — PHYSICAL MARKETS

### Purpose
A screen for factors that exist outside financial markets.

### Show
- Oil / gas inventories
- Production
- Refinery activity
- Commodity curves where data is available
- Shipping/transit pulse
- Trade-flow snapshots
- Weather anomalies
- Agriculture/monsoon indicators where useful
- Selected freight indicators if obtainable

### Core concept
**"Is the market move supported by the physical economy?"**

Use simple historical comparisons and anomaly scores rather than pretending to have professional commodities analytics.

---

# 6. F6 — CROSS-MARKET INTELLIGENCE

## FLAGSHIP ANALYTICS SCREEN

### Purpose
Answer:

> **"How does this factor affect the rest of the market?"**

### Main visualization
Interactive network / propagation graph.

Example:

```text
                GEOPOLITICAL SHOCK
                       │
                 OIL SUPPLY RISK
                       │
              ┌────────┴────────┐
              ↓                 ↓
            BRENT             SHIPPING
              │                 │
        ┌─────┴─────┐       FREIGHT
        ↓           ↓           │
      INR         CPI           ↓
        │           │       AIRLINES
        ↓           ↓
       RBI         RATES
        │           │
        └─────┬─────┘
              ↓
           EQUITIES
```

### Capabilities
- Event → factor → sector → company → asset chain
- Current price reaction beside relationships
- Historical correlation / co-movement where meaningful
- Impact ranking
- Positive/negative exposure
- Scenario slider
- "Who is exposed?"
- "Who benefits?"
- "What breaks this thesis?"
- Historical analogs / replay

### Scenario example

```text
Brent = $120

Most exposed:
Airlines       HIGH NEGATIVE
Chemicals      HIGH NEGATIVE
Paints         MEDIUM NEGATIVE
Upstream Oil   HIGH POSITIVE

India inflation risk: HIGH
INR pressure:         MEDIUM/HIGH
```

### Critical design choice
Do NOT attempt a fully automatic global causal knowledge graph.

Start with a curated, human-reviewed relationship/sensitivity matrix for the most important market factors and let search/research discover candidate new edges later.

---

# 7. F7 — RESEARCH DESK

## MAIN AGENTIC FEATURE

### Purpose
A trader asks a question and gets a proper investigated answer.

Examples:

```text
Why is Brent up today?

Deep dive into NVDA before earnings.

What happens to Indian equities if oil reaches $120?

Investigate this shipping disruption.

Why is copper moving despite weak PMI?
```

### User experience
The agent visibly investigates:

```text
Resolving asset...
Searching news...
Checking market data...
Checking trends...
Investigating supply chain...
Checking macro...
Corroborating...
Writing report...
```

### Report output
- Executive thesis
- What happened
- Primary drivers
- Supporting evidence
- Contradicting evidence
- Affected assets
- What to watch next
- Confidence
- Sources + timestamps
- Relevant charts / mini visualizations

### Agent scope
Use existing agent/research infrastructure rather than building an agent framework from scratch.

Target:
**one orchestrator + selectively spawned specialist investigators**.

Not a permanent swarm.

---

# 8. F8 — SIGNALS / ANOMALIES

### Purpose
Surface things worth investigating.

### Show
- Cross-asset anomaly heatmap
- Unusual price/volume moves
- Search-interest spikes
- News-intensity spikes
- Shipping/transit anomalies
- Weather disruptions
- Insider clusters
- Positioning extremes
- Divergence signals

### Example

```text
BRENT +6.1%
NEWS INTENSITY +143%
SEARCH INTEREST +88%
HORMUZ TRAFFIC -29%

→ SUPPLY-SHOCK CANDIDATE
```

Every signal has an `INVESTIGATE` button.

---

# 9. F9 — INDIA LENS

### Purpose
Make the product feel specifically relevant to an Indian trader.

### Show
- NIFTY / SENSEX
- Sector movers
- INR
- Indian rates / RBI indicators
- India inflation / growth
- crude exposure
- monsoon/weather
- India-relevant global events
- FPI/market headlines where data is available
- India-specific Google News / Trends localization

### Hero query
> **"What matters to Indian equities today?"**

This can invoke a compact research routine.

---

# 10. F10 — MEMO / MORNING BRIEF

### Purpose
A concise autonomous briefing.

```text
GOOD MORNING — 09:00 IST

MARKETS
...

TOP EVENTS
...

UNUSUAL SIGNALS
...

PHYSICAL WORLD
...

WHAT CHANGED SINCE YESTERDAY
...

WATCHLIST
...
```

All important claims are sourced.

This is mainly an agent/reporting layer, not another huge screen.

---

# 11. Global command palette

A Bloomberg-style command/search layer ties the terminal together.

Examples:

```text
AAPL
BRENT
NIFTY
WHY OIL?
HORMUZ
OIL → AIRLINES
INDIA TODAY
DEEP DIVE NVDA
WHAT CHANGED?
SHOW ANOMALIES
```

It should make the application feel like a terminal rather than a normal dashboard.

---

# 12. Product-wide UX primitives

## Evidence everywhere
Any important number/event/AI claim should be expandable to:

- source
- URL
- source type
- retrieval timestamp
- underlying observation
- related corroborating source(s)

## Time awareness
Every dynamic value should show its data timestamp/freshness when material.

## Drill-down everywhere
A chart point, map event, node, factor or signal should lead somewhere useful.

## No dead-end AI
Every AI conclusion should expose the evidence behind it.

---

# 13. Final MVP priority

## Tier 1 — Must feel excellent

1. Command / Market Home
2. Asset / Company
3. Events / News
4. World / Logistics Map
5. Cross-Market Intelligence
6. Research Desk
7. Signals / Anomalies

## Tier 2 — Strong supporting surfaces

8. Physical Markets
9. India Lens
10. Morning Memo

## Not MVP

- Full portfolio management
- Full backtesting engine
- Institutional-grade options analytics
- Full social sentiment scraping
- Live global logistics coverage
- Full satellite analytics
- Full knowledge graph
- Voice assistant
- Mobile application
- Authentication / multi-user platform
- Huge Bloomberg-function replication

---

# 14. The three hero experiences

### Hero 1 — "Why is oil moving?"
Market move → news → trends → physical data → shipping → evidence-backed explanation.

### Hero 2 — "Show me the impact"
Shock → propagation graph → affected industries/companies → scenario slider.

### Hero 3 — "Investigate this"
User query → visible research process → multi-source investigation → polished cited report.

Everything else supports these three.

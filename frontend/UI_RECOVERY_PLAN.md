# AAJ Terminal — UI Recovery & Peak Flow Plan

**Date:** 2026-09-24  
**Status:** Executed 2026-09-24 — core recovery shipped; see checklist below (most P0/P1 checked).  
**Inputs:** User QA, [Markets home audit](27834b9a-1b19-494a-9907-e7d4bf51354f), [Asset audit](ff8e9794-ea6b-4235-9ed3-b8c610e5341e), [Map audit](160cbf22-1d36-4c66-b47e-f698a7955352), [Events/Cross/Research audit](2d96b2b7-1430-4b6c-8181-40e7591e5e34), `FRONTEND_CONTRACT.md`, `09_AGENT_UI_PEAK.md`.

---

## 0. What went wrong (honest)

| Symptom you reported | Root cause in code |
|----------------------|-------------------|
| **Map doesn’t load / PC melts** | `DeckOverlay` redraws **up to 2000** AIS dots + **PathLayer headings on every vessel with SOG>0.5** on **every WS diff (0.5s)**. No viewport culling, no layer budget. `LayerToggles` uses **`alert()`** on guardrail — feels like a crash. |
| **Home “worse” — big wrong things, small chart** | Recent tile grid **increased visual noise** (favicons/monograms per tile) without **canonical ▲/▼ change column**. Featured chart still **`compact` ~252px** in a tall panel; **matrix/events/movers compete** with no single “watchlist table” mental model. |
| **Can’t tell up vs down** | Change % is small colored text; **no ▲▼**, no **signed column**, no **day range**, no **sort by %**. Favicon fallbacks look like random logos, not finance UI. |
| **Agent / Desk useless** | Investigate is a **small card in left column**; **no ticker dropdown**, no “research this symbol” from home/asset. WS final often **missing `evidence`** → empty citations. |
| **Everything disconnected** | No **global instrument context** (selected ticker persists across Markets → Asset → Desk → Map choke). Nav is route-only; **⌘K** exists but not a **visible instrument picker**. |

---

## 1. North star — one user journey

```
Pick instrument (header dropdown or ⌘K)
    → Markets: see quote + % + sparkline in ONE table; click row → featured chart updates
    → Asset: full chart + verdict + news; one “Investigate {TICKER}” CTA
    → Desk: ticker pre-filled; trace + report + resources (stock-scoped query templates)
    → Map: choke linked to commodity (BRENT → hormuz); map loads fast, max 3 overlay layers
    → Cross: shock = selected commodity; heatmap matches backend matrix
    → Events: filter by instrument / choke from context
```

**Design rule:** Every screen answers in 3 seconds: **What is it? Up or down? Why should I care? Where next?**

---

## 2. Global shell (all routes) — P0

### 2.1 Instrument picker (replaces “disconnected pages”)

- [x] **Header `InstrumentSelect`**: dropdown of curated tickers from `GET /api/market-home` (indices + commodities + fx + US10Y + BTC/ETH). Shows **price, ▲/▼ %, stale dot**.
- [ ] **Persist selection** in `sessionStorage` + React context `InstrumentContext` (`ticker`, `setTicker`).
- [ ] **Wire context** to: `MarketHome` featured chart, `ResearchDesk` default query (`Why is {ticker} moving?`), `CrossMarketPage` `shockAsset`, `AssetPage` redirect if on `/asset/:ticker` mismatch optional.
- [ ] **⌘K** remains power-user; picker is primary for judges.

### 2.2 Finance-readable change language (no “emoji”, no mystery icons)

- [ ] **`ChangeCell` component**: `▲ +2.41%` green / `▼ −1.08%` red / `—` flat; **always** `font-mono tabular-nums`; optional **▲▼ only on tiles**, full % on tables.
- [ ] **Tiles use monogram OR no icon** — pick one: **table rows = no favicon**; asset page header keeps single icon. Remove favicon grid from home tiles (user: “wrong shit bigger”).
- [ ] **Legend strip** under header once: `Green = up · Red = down · Amber dot = stale seed`.

### 2.3 Navigation coherence

- [ ] Replace `<a href>` with `<Link>` on header + in-app CTAs (no full reload).
- [ ] Breadcrumb on inner pages: `Markets / BRENT` or `Desk / BRENT`.

---

## 3. Map page — P0 (stability + actually loads)

### 3.1 Performance (stop freezing the machine)

- [ ] **Cap rendered AIS dots** by zoom: e.g. `zoom < 5 → max 200`, `zoom 5–7 → 800`, `zoom ≥ 7 → 1500` (never 2000 PathLayers).
- [ ] **Remove or gate `headings` PathLayer** below zoom 8 OR sample 1-in-N vessels.
- [ ] **Throttle deck updates**: batch WS diffs with `requestAnimationFrame` / 250ms debounce on `setProps`.
- [ ] **Lazy-load deck**: dynamic `import()` for `DeckOverlay` so `/map` shows basemap first.
- [ ] **Error boundary** on map route with “Reload map” + disable overlays toggle.

### 3.2 Guardrails UX (not alerts)

- [ ] **`assertMapLayers`**: toast inline “Turn off a layer first (max 3)” — **never `alert()`**.
- [ ] Count **only user toggles** toward 3; **AIS basemap dots** are not a “layer” in the UI copy.
- [ ] Default visible: **`ais` only**; presets: “Shipping”, “Hazards” (eq+weather), not 8 buttons at once.

### 3.3 Loading & empty states

- [ ] **Skeleton map** + `GET /api/map` choke pills; **prefetch** `fetchMapBox(choke)` before WS.
- [ ] **`fitBounds(bbox)`** when box loads (fix G-012 flash).
- [ ] If WS `dead`: banner + REST positions; if both fail: **static choke card** still usable.
- [ ] **Map health indicator**: `AIS live · 842 vessels` not `connecting` forever.

### 3.4 Panel & history (already partially fixed)

- [ ] Verify `ChokepointPanel` + `CrossingsChart` after history normalize (done in code; QA screenshot).
- [ ] Layer toggles **left of drawer** (done); QA at 1440 that controls are clickable.

### 3.5 Backend/data

- [ ] Add **seed `ports.geojson` / `routes.geojson`** or show **“layer unavailable”** on toggle (not blank).

---

## 4. Markets home (`/`) — P0 (standard finance home)

**Target layout (1440px):** Bloomberg-simple — **one hero chart**, **one dense watchlist table**, **sidebar movers + events**. Not six competing panels of equal weight.

### 4.1 Information hierarchy (fix “nothing understandable”)

| Zone | Height budget | Content |
|------|---------------|---------|
| **Anomaly strip** | 32px | Real API only; link to `/map?choke=`; remove fake “92% aligned”. |
| **Watchlist table** | ~40% above fold | **Sortable columns**: Symbol · Last · **Change ▲▼** · % · Sparkline 60×20 · Stale. Group: Indices / Commodities / FX / Crypto. |
| **Featured chart** | ~45% width, **min 320px tall** | Selected row drives chart; **volume pane**; header: ticker + price + **ChangeCell** + Open Asset + Desk. |
| **Right rail** | 4 cols | Movers (top 5 by \|%Δ\|) + Event headlines (linked). |
| **Cross-matrix** | Below fold | Single row teaser + “Open cross-market →”; cell click passes shock. |

### 4.2 Revert harmful home changes

- [ ] **Remove tile grid** for primary quotes — user feedback: worse. Use **table** (Robinhood/Coinbase pro pattern).
- [ ] **Featured chart**: drop `compact`; use **`mainH` 320–360** in home panel; panel `min-h` matches chart + volume.
- [ ] **Double-click / separate link** for asset — single click row = **select for chart only** (already intended; enforce in table).

### 4.3 Backend wiring (must work)

| UI | API | Acceptance |
|----|-----|------------|
| Watchlist rows | `GET /api/market-home` | Every row shows price + % from `normalizeQuoteFromRecord`; stale badge. |
| Featured chart | `GET /api/asset/{ticker}` | Chart loads; skipped shows banner. |
| Movers | same home payload | Sorted by \|change\| ; includes crypto. |
| Events | `event_ticker[]` | Title links `/events?q=`. |
| Matrix teaser | `GET /api/cross-market` | `matrixToCells` curated arrays (fixed); error state not “Loading…”. |

---

## 5. Asset page (`/asset/:ticker`) — P0/P1

- [ ] Hero: **large price + ChangeCell**; chart **260+84**; sticky subheader on scroll.
- [ ] **Investigate {ticker}** button → `/research?research=Why+is+{ticker}+moving`.
- [ ] **Map link** via `physical_corroboration.entity_id` (fixed in code; QA live).
- [ ] **Filings** SourceRecord shape + EDGAR links (fixed; QA).
- [ ] **Dedupe** physical vs narrative blocks (one verdict).
- [ ] **EvidenceChip** on chart + trends (08 spec).

---

## 6. Research Desk (`/research`) — P0 (stock-wise, not corner box)

Per `09_AGENT_UI_PEAK.md` + user: **ticker-first investigation**.

### 6.1 Layout rewrite

- [ ] **Top bar full width**: `[InstrumentSelect]` + large query input + **primary Investigate** (not buried in 340px column).
- [ ] **Suggested prompts** chips: `Why is {ticker} up today?` · `Physical vs narrative` · `News risk` · `Cross-market exposure`.
- [ ] **Three columns below** only after run starts; idle state = **empty center with prompts**, not dev strings about WS paths.

### 6.2 Backend

- [ ] **Backend**: include `evidence[]` in WS final + `POST /api/research/run` (blocks empty Resources).
- [ ] **Frontend**: mount **`ResourcesPanel.tsx`** (remove inline duplicate).
- [ ] **sessionId** from URL path (fixed; QA share link).

### 6.3 Trace UX

- [ ] Hide raw JSON dumps in `TracePanel` by default; show **engine · query · result_count · timestamp** per row.
- [ ] Pre-answer **source favicon row** (Perplexity pattern) when first SerpApi trace arrives.

---

## 7. Cross-market, Events, Map links

### Cross-market

- [ ] Read `?shock=` from URL (done); initial simulate on mount (done).
- [ ] Heatmap domain matches data: weights **0–1** on GET matrix, **±40** after simulate — label both.
- [ ] Remove dev labels (“oklch slate→amber”); align colors or copy.

### Events

- [ ] Loading/error states; surface `what_people_are_asking`.
- [ ] Choke IDs → `/map?choke=`.
- [ ] Stable cluster `id` from backend (follow-up backend task).

---

## 8. Component inventory (build list)

| Component | Purpose |
|-----------|---------|
| `InstrumentContext` + `InstrumentSelect` | Global ticker |
| `ChangeCell` | ▲▼ % everywhere |
| `QuoteTable` | Home + optional asset sidebar |
| `FeaturedChartPanel` | Home chart wrapper with correct heights |
| `MapPerformance` utils | cull, throttle, cap |
| `Toast` / inline guardrail | replace alerts |
| `ResearchHero` | Desk top bar + ticker |
| `DeskIdle` | Prompts when no run |

---

## 9. QA gates (every item checked before “done”)

- [ ] **Map**: open `/map` — basemap <2s, CPU stable 60s, toggle 3 layers no alert crash.
- [ ] **Home**: judge can point to **green/red ▲▼** on 10 symbols without scrolling.
- [ ] **Desk**: pick BRENT from dropdown → Investigate → trace shows SerpApi rows → report cites.
- [ ] **Flow**: Markets select WTI → chart updates → Desk → query mentions WTI → Asset link works.
- [ ] `npm run test` + visual at 380/1024/1440 with dev server up.
- [ ] `curl` smoke: market-home, asset, map, cross-market, research run.

---

## 10. Execution order (complete list — work until all boxes checked)

### Phase A — Stop the bleeding (same day)

1. Map perf caps + throttle + no alert guardrail  
2. Map load skeleton + REST fallback banner  
3. Home: **QuoteTable** + **ChangeCell**; revert tile grid  
4. Home: enlarge featured chart; demote matrix below fold  
5. **InstrumentSelect** in header + context  

### Phase B — Coherent journey (day 2)

6. Research **ResearchHero** + ticker dropdown + prompt chips  
7. Backend **evidence** on research WS/POST  
8. **ResourcesPanel** wired  
9. Asset investigate CTA + dedupe verdict  
10. Cross/events polish + loading states  

### Phase C — Peak polish (day 3)

11. EvidenceChip on charts/trends  
12. News timeline density  
13. Map geo seed files or skip badges  
14. Full visual regression + demo script 60s  

---

## 11. Out of scope (explicit)

- Light/marketing theme (user rejected).
- New backend features except `evidence` on research + cluster `id` (tracked as backend subtasks).
- Replacing lightweight-charts / deck.gl engines.

---

**Owner sign-off:** When Phase A–C are checked, home reads as a **standard watchlist + chart**, map **loads without melting GPU**, desk is **stock-scoped and full-width**, and **every page shares the same selected ticker**.

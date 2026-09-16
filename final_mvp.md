# AI-Native Market Intelligence Terminal — FINAL MVP (Locked Scope)

> Supersedes the scope implied in `aajmvp.md` (F1–F10). This is the build list. Everything not listed here is explicitly cut for MVP.

---

## 0. Thesis + moat

Markets move because the physical/informational world moves first. The terminal makes that causal chain visible: **event → physical signal → market reaction → exposure → investigation.**

**The pitch:** we built a Bloomberg terminal for free using SerpApi — but the moat isn't the terminal, it's the verdict. We fuse physical-world corroboration (chokepoint ship traffic) with *pre-narrative* attention signals (rising search queries, regional interest spikes, raw autocomplete questions) into a single "is this move real, and is it already priced in" verdict — before the story is fully written by news outlets, not after. That's the claim every SerpApi-derived signal on the terminal exists to prove.

## 1. The one demo spine (everything serves this)

```
Brent moves
   → Market Home flags it
   → Asset screen shows PHYSICAL vs NARRATIVE verdict
   → click "WHY IS THIS MOVING?"
   → Research Desk runs (visible stages, visible SerpApi calls)
   → World Map shows Hormuz tanker traffic vs 7-day baseline
   → Cross-Market panel shows exposed sectors
   → cited report renders
```

If a feature doesn't serve this spine, it's not in the MVP.

---

## 2. Screens — IN

| Screen | Scope |
|---|---|
| **Market Home** | Indices, FX, rates, commodities, crypto, movers, event ticker. Includes a persistent **anomaly strip** (see §5) — not a separate Signals screen. |
| **Asset / Company** | Price/chart, fundamentals, news timeline, Physical-vs-Narrative verdict panel, "WHY IS THIS MOVING?" button. |
| **Events / News** | Headline clusters, timeline, click-through to affected commodity/sector/company chain. |
| **World Map** | ONE chokepoint (Strait of Hormuz) with live layer. Spec in §3. |
| **Cross-Market Matrix** | Curated, human-authored sensitivity matrix (not an auto-discovered graph). Includes scenario slider (see §5). |
| **Research Desk** | Fixed-pipeline agent, reusing existing Hermes + DeepSeek harness. Spec in §4. |

## 3. World Map — build spec (good to go)

**Base layer:**
- MapLibre GL JS + a free, no-key vector tile source (e.g. OpenFreeMap) — zero rate-limit risk, no API key management, includes place labels/coastlines out of the box.
- No Overpass/OSM POI queries needed for MVP — base tiles already carry enough geography. Skip that P1 work entirely.

**Static context layer:**
- Hardcoded JSON: chokepoint markers (Hormuz, Suez, Malacca, Panama) as *labeled dots only* — cheap, adds visual credibility that "the world" exists beyond your one live spot, zero engineering cost.

**Live layer (Hormuz only):**
- AISStream websocket, subscribed to Hormuz bounding box only.
- In-memory latest-position cache per vessel (MMSI), throttled render (batch every few seconds, not per-message).
- Vessel markers color-coded by type (tanker/cargo/other).
- Traffic count in box vs a **7-day rolling baseline** — start logging this the day you turn the feed on, so by demo week you have a real baseline, not a placeholder number.
- Click a vessel/chokepoint → side panel: current count, baseline, % change, linked markets (pull straight from the Cross-Market curated matrix — no new data needed).

**Demo safety (non-negotiable):**
- Cache last-known-good snapshot (positions + computed anomaly %) on an interval. If the AISStream socket drops mid-demo, render from cache instead of an empty/error map. This is the single highest-value defensive line item on the whole map — build it early, not as an afterthought.

**Explicitly cut:** aviation layer, weather layer, wildfire/earthquake layers, any chokepoint beyond Hormuz getting live data.

## 4. Research Desk — build spec

Built on LangGraph via the `langchain-ai/open_deep_research` scaffold, with DeepSeek as the model backend (reusing the DeepSeek inference setup from the existing stock-research tool). Fixed pipeline, not an open-ended agent loop — full detail in `agentic_implementation_plan.md`:

```
1. Resolve asset/query           — deterministic
2. Structured market pull         — Alpha Vantage / yfinance (parallel)
3. SerpApi google_news            — fixed template, bounded result count
4. SerpApi google_trends          — same
5. SerpApi google_search          — 1–2 follow-ups; LLM may choose the
                                     specific follow-up query based on
                                     stage 3/4 output (this is the one
                                     place real agentic choice lives)
6. Physical/macro corroboration   — EIA / AISStream anomaly number
7. Synthesis                      — single LLM call → cited report
```

Every stage timeout-guarded with a fallback ("skipped — no data" rather than hanging). Inference stays cloud-side (DeepSeek) for demo reliability — don't depend on local compute live.

UI narrates each stage as it fires ("Searching news...", "Checking trends...") plus a **search trace panel** showing the literal SerpApi calls (engine, query, timestamp) as they happen. This one panel is your cheapest, highest-leverage "meaningful SerpApi usage" evidence for judges.

## 5. Small high-leverage additions (cheap because they reuse data you're already computing)

These are worth adding — not scope creep, near-zero marginal data work:

- **Command palette** (global search/jump bar: `AAPL`, `BRENT`, `WHY OIL?`, `HORMUZ`) — pure frontend routing over screens you're already building. Big "feels like a real terminal" payoff for the cost.
- **Evidence hover cards** — any number/claim on any screen expands to source + timestamp on hover. Small UI component, reused everywhere, directly reinforces "cited" positioning judges will notice.
- **Anomaly strip on Market Home** — a persistent ticker combining price move + news intensity + trends spike + Hormuz traffic delta, all data you already have from the Hero-1 pipeline. Replaces the cut Signals screen entirely — same signal, zero new data layer.
- **Scenario slider on Cross-Market Matrix** — "Brent = $120 →" recomputes exposure using your curated static sensitivities. It's just arithmetic over data you already authored; looks like real analytics.

### Moat-proving additions (these directly demonstrate §0's pitch — treat as near-required, not optional polish)

- **Rising/breakout queries badge** — extract the "rising related queries" field from the `google_trends` call you're already making for the Physical-vs-Narrative panel. Zero new API calls. Shown as a small chip row (e.g. `Hormuz blockade ↑850%`) next to the panel — this is pre-narrative attention, visually undeniable to a judge.
- **Regional interest strip** — same `google_trends` call, add `geo` breakdown, show top 3-5 countries as a small bar strip. Zero new API calls, ties visually to the map you're already building.
- **"What people are asking" panel** (`google_autocomplete`) — one new, cheap engine call (`why is {asset} `, `{event} `), raw suggestion list rendered on Asset/Event screens. Already budgeted at 10 calls/mo in the original allocation. Most judge-legible feature in the whole plan — no explanation needed, they just read it.

## 6. Explicitly NOT in MVP

Physical Markets screen, standalone Signals screen, India Lens, Morning Memo, aviation/weather/disaster map layers, multi-chokepoint live data, auto-discovered relationship graph, portfolio/backtesting/auth, any SerpApi engine beyond `google_news` / `google_trends` / `google_search` (Shopping/Jobs/Patents/Maps stay P2, add only if a checkpoint shows spare time).

## 7. SerpApi usage

Engines: `google_news`, `google_trends`, `google_search`, `google_autocomplete`. Note that rising-queries and regional-interest are *fields already present* in the `google_trends` response — they add zero marginal calls, just unlock data you're already paying for. Cache by engine + normalized params + time bucket. Key-rotation wrapper across your accounts for dev/test headroom and as a genuine rate-limit failover feature — but the actual judged/recorded demo run uses one key against a warm cache.

## 8. Build order (3 people, checkpoint-driven)

| Phase | Owner focus | Target |
|---|---|---|
| 1 | Data adapters (SerpApi, Alpha Vantage, SEC, FRED) + caching | Deterministic screens renderable |
| 2 | Market Home + Asset + Events (frontend) | Hero-1 narrative walkable without map/agent |
| 3 | Map: base tiles + Hormuz AISStream + fallback cache | Map screen demo-safe |
| 4 | Research Desk retrofit (Hermes/DeepSeek → fixed pipeline) + search trace panel | End-to-end Hero-1 works live |
| 5 | Small additions (§5) — **only if Phase 1–4 are solid** | Polish |

Checkpoint at ~day 10–12: if Phase 1–4 aren't demo-clean, §5 gets cut before anything else does.

## 9. Judging-criteria mapping (for the written explanation / repo README)

- **Idea strength / originality** — physical-world → market causality, not a stock dashboard with an LLM button.
- **Technical complexity** — multi-provider adapter layer, live AIS anomaly detection, curated sensitivity matrix, retrofit agent pipeline with bounded tool use.
- **Usefulness** — Physical-vs-Narrative verdict is an analytic output, not an opinion; evidence hover cards make every claim checkable.
- **Meaningful SerpApi usage** — news (catalyst discovery), trends (attention signal), search (agent research) — structurally load-bearing, shown live via the search trace panel, explained explicitly in the README per the competition's stated preference.

# FUTURE PROSPECT — Terminal Pilot Agent (explicitly NOT MVP scope)

> ⛔ FUTURE SCOPE ONLY. Nothing in this file is built for the MVP or the hackathon submission. MVP agent = Deep Investigate fixed pipeline in `agentic_implementation_plan.md`, nothing else. This file exists so the README/video can close with "where this goes" and so a future sprint has a ready spec. Do NOT pull tasks from here into the current build.

## 0. The idea in one line

A fully agentic **Terminal Pilot**: the agent uses the ENTIRE terminal through tools — every screen, every dataset, every visualization becomes callable. It retrieves data, generates charts/tables/map views/memos on demand, chains multi-step workflows, and narrates what it's touching (`Checking trends... → Comparing Hormuz vs Malacca... → Running $120 scenario... → Charting it...`).

Demo sentence (future): *"Ask anything. It drives the terminal for you — and builds the view you asked for."*

## 1. Full-terminal tool coverage (the entire terminal, callable)

Every tool wraps an EXISTING service (no new providers, even in future). All return `{answer, records[], stale, view_spec?}` — `view_spec` lets the agent GENERATE frontend artifacts (charts, tables, map states, memos) from words. All read-only except ✋ marks.

**Markets & assets:** `market_snapshot(asset)` (quote + multi-timeframe deltas + vs sector/index + freshness, one call) · `compare_assets(tickers[])` (normalized overlay series + relative performance table) · `company_dossier(ticker)` (fundamentals + filings + Form 4 cluster + news timeline — Bloomberg FA/GF in one call) · `earnings_lens(ticker)` (dates + expectations vs positioning).

**Attention & narrative (SerpApi, the moat):** `attention_pulse(asset)` (normalized trends + rising queries + top-5 geo + price-vs-attention divergence flag) · `news_intel(query)` (deduped clusters + severity + `chokepoint_ids`/sector tags + price-reaction — also feeds the map event overlay) · `ask_the_crowd(asset_or_event)` (raw autocomplete + breakout ranking — pre-narrative questions).

**Physical world:** `chokepoint_pulse(id?)` (count vs 7d baseline + %) · `compare_chokepoints()` (all 5 ranked — "Hormuz vs Malacca?" in one call) · `crossings_flow(id)` (inbound/outbound bars + charter for the mini-chart) · `trade_arcs(filter)` (UN Comtrade OD pairs for the ArcLayer) · `physical_roundup()` (AIS worst-box + EIA prints + weather/disaster toggles, one brief).

**Cross-market & macro:** `exposure_map(shock)` (curated solid + SerpApi dashed candidate edges + `exposed_chokepoints[]`) · `run_scenario(shock_asset, value)` (winners/losers + INR/CPI flags) · `macro_lens()` (FRED watchlist + key prints) · `what_changed(since)` (overnight diff → brief).

**Generative & control:** `gen_chart(spec)` (overlay/multi-axis/anomaly-band charts from any two series — "chart Brent vs Malacca traffic 7d") · `gen_table(spec)` (ranked exposure/comparison tables) · `gen_mapview(spec)` (camera + layers + highlights — "fly to worst chokepoint, overlay events") · `gen_memo(spec)` (morning-brief style cited digest) · `deep_investigate(query)` ✋ (spawns the MVP 7-stage pipeline, streams its trace into chat) · `palette_go(cmd)` ✋ + `toggle_layer(id)` ✋ + `edit_watchlist(op)` ✋ (local-only writes: routing, layers, watchlist).

Tool rules (future): ≤8 tool calls per answer, 15s timeout → skip + `stale` badge, cache-first (follow-ups ≈ zero SerpApi burn), no claim without records, no raw-trends cross-comparison, tool chips rendered per answer as complexity evidence.

## 2. What peak looks like — all-out capabilities (future demo beats)

1. **Drive-by analysis:** `"Why is Brent up?"` → snapshot + news_intel + attention_pulse + chokepoint_pulse in parallel, verdict card rendered inline, `→ Deep Investigate` offered.
2. **Follow-up memory:** `"and airlines?"` / `"what about HDFC?"` → context-resolved via exposure_map, no re-typing, chart attached.
3. **Map as answer:** `"show worst chokepoint"` → gen_mapview flies there, card pulses, crossings chart opens. `"compare Hormuz vs Malacca"` → ranked table + dual highlight.
4. **Scenario on demand:** `"what if oil hits $120?"` → run_scenario + exposure_map + INR/CPI + winners/losers + map highlight, all inside chat.
5. **Pre-narrative flex (the moat):** `"is this priced in?"` → PRICE vs ATTENTION vs PHYSICAL triple + rising queries + crowd questions — before news writes the story.
6. **Dossier in one shot:** `"deep dive NVDA before earnings"` → dossier + intel + pulse + exposures → spawns Deep Desk, narrates stages.
7. **Morning brief:** `"what matters today?"` → gen_memo from what_changed + anomalies + events + watchlist, cited.
8. **Skeptic mode:** `"what breaks this thesis?"` → contradicting evidence + candidate-edge caveats + extremes.
9. **Chart/table/map-from-words:** any `gen_*` artifact composed live from cached series — the "generate charts and what not" promise.
10. **Full terminal control:** routing, layer toggles, watchlist edits, memo export — agent as control plane.
11. **Proactive pilot (later):** watches anomaly strip, pushes briefs (`Hormuz just flipped -12% → want exposures?`).
12. **Portfolio-aware + alerts + analog replay (later):** personal exposure answers, user-defined triggers on cached data, "last 3 Hormuz scares → airlines -x% in N days" backtest-lite.

## 3. Why this is explicitly future, not now

Requires: chat panel UI + artifact renderer (`view_spec` → charts/map states) + ReAct loop + eval harness + quota model for conversational use. That's a second frontend + second agent system on top of an unfinished spine. Building it now risks the demo. The hackathon is won by the spine (verdict + map + trace + report); this file is the "we know exactly where it goes" credibility closer.

## 4. Future build order (when a post-MVP sprint starts)

1. `research_desk/tools/terminal_tools.py` (all §1 tools over existing services).
2. `research_desk/ask_anything.py` (ReAct loop, DeepSeek, strict JSON args).
3. Chat panel + `view_spec` renderer (cards, charts, map-mini, tables, memo export).
4. `MOCK_MODE` replays for every §2 beat.
5. Eval: 20-question suite (follow-ups, scenarios, map commands, skeptic) + quota accounting per answer.

## 5. Judging mapping (for future README)

Idea/originality → terminal-as-body + pre-narrative verdict. Complexity → 20-tool ReAct + pipeline handoff + generated artifacts, streamed. Usefulness → seconds-to-answer + memory + scenario + briefs. Meaningful SerpApi → 4 SerpApi tools load-bearing in almost every answer, trace visible live.

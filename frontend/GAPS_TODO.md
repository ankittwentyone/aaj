# GAPS TODO — Frontend Scaffold (auto-generated from 13_ENGINEERING_GAP_AUDIT.md)

> **Source:** `~/.opencode/plan/13_ENGINEERING_GAP_AUDIT.md` — exhaustive audit 2026-09-24
> **Scaffold:** 758 lines `frontend/src/**/*` (ls -R verified)
> **Rule:** Check off only when `grep` + `curl` + `screenshot` triad passes per `06` merge gate.

## P0 — Demo Blockers (fix before video)

- [ ] **G-001** `GET /api/geo/{layer}` orphan — `WorldMapPage.tsx:13` + `DeckOverlay.tsx:8` wire 4 geo layers (ports/routes/tss_lanes/trade_arcs)
- [ ] **G-002** `GET /api/map/layers/{feed}` orphan — `WorldMapPage.tsx:16` + `DeckOverlay.tsx:14` wire weather/earthquakes/disasters dots; fix `LayerToggles avia` mismatch
- [ ] **G-003** `GET /api/map/{id}/history` orphan — `ChokepointPanel.tsx:3` fetches history into `CrossingsChart` (30d playback)
- [ ] **G-004** `GET /api/events/{id}/chain` orphan — create `src/components/Events/ChainDrawer.tsx:1` drill from `EventsPage`
- [ ] **G-005** `CommandPalette` unreachable — mount in `App.jsx:11` + global `⌘K` listener
- [ ] **G-006** `WorldMap` not full-bleed — `MapView absolute inset-0` + `LayerToggles bottom-6 right-6` + `ChokepointPanel drawer` + `bbox center`
- [ ] **G-007** `Cite.tsx` + `FaviconImg.tsx` missing — `ReportView` `getCiteStyle` amber vs zinc
- [ ] **G-008** `ResourcesPanel.tsx` missing — grouped evidence `provider/dataset` with favicon `s2/favicons`
- [ ] **G-009** `ResearchDesk` single-col → 3-col `340 + 1fr + 360` sticky
- [ ] **G-010** `useResearchWS` no backoff/jitter + blocking fallback `postResearchRun`

## P1 — Spec Fail / Empty (fix before merge gate)

- [ ] **G-011** `POST /api/research/run` orphan fallback
- [ ] **G-012** `MapView` hardcoded viewState `28,18 zoom2.4` ignores `?choke=` bbox
- [ ] **G-013** `CrossMarketPage` simulate no debounce + hardcoded BRENT + typo `r.exposures ?? r.exposures`
- [ ] **G-014** `CrossMarketPage` `pre` dump → `HeatmapMatrix.tsx` `44×28 gap2 oklch slate→amber`
- [ ] **G-015** `IndexStrip`/`TickerMarquee` missing `Sparkline 60×20` (Monef steal)
- [ ] **G-016** `StockRow.tsx` + `Watchlist.tsx` missing (Stock 27725958 steal)
- [ ] **G-017** `/events` route `Navigate to /#events` kills `EventsPage.tsx` — remove redirect in `App.jsx:34`
- [ ] **G-018** Zod schemas + `tests/contract.test.ts` `serpapi_coverage` missing
- [ ] **G-019** `MarketHome` missing `TickerMarquee` mount + `EventTicker` linked highlight
- [ ] **G-020** `AssetPage` missing `rising_queries_badge`/`regional`/`asking`/`physical_corroboration`/`fundamentals`/`news_timeline`
- [ ] **G-021** `staleTier` bypassed in `ChokepointPanel`/`EvidenceChip` — use `StaleBadge`
- [ ] **G-022** `analytics.ts pushTrace/__AAJ_TRACE` never called — wire `useResearchWS.ts:50`
- [ ] **G-023** `ResearchDesk sessionId` rotates per render — `useRef` stable
- [ ] **G-024** Mobile 380px overflow — `ChokepointPanel 380 fixed` + `MarketHome grid-cols-12` not responsive
- [ ] **G-025** `Dialog` missing `role=dialog` focus trap + `CommandPalette` `↑↓ Enter Esc` `aria-activedescendant`
- [ ] **G-026** `DeckOverlay` no `linkedHighlight` wiring `getFillColor highlight`
- [ ] **G-027** `CrossingsChart` `counts: number[]` vs `counts[{ts,vessels}]` drift
- [ ] **G-028** `ChartPanel` missing pane2 `HistogramSeries` volume `h84`
- [ ] **G-029** `TracePanel` `jitter()` defined unused
- [ ] **G-039** Trends badges not mounted `AssetPage`
- [ ] **G-041** `react-markdown/rehype-sanitize/remark-gfm` not in `package.json`
- [ ] **G-042** `MapView` `ws.vessels ?? rest` fallback blank at `connecting`

## P2 — Polish / Perf / A11y Headroom (fix within week)

- [ ] **G-030** `ScenegraphLayer.tsx` GLB vessel preview
- [ ] **G-031** Clustering at `zoom<5` (Shipping 27355064)
- [ ] **G-032** TSS/Ports GeoJSON styling `oklch` desaturation
- [ ] **G-033** `FilingsList` SEC link to EDGAR
- [ ] **G-034** `ChartPanel status:skipped` banner not bare `No chart data`
- [ ] **G-035** `index.html display=swap` → `optional` + preload
- [ ] **G-036** `frontend/aesthetic.lock.json` hash gate + `scripts/check_aesthetic.js`
- [ ] **G-037** `mocks/browser.ts worker.start()` never called + `public/geo/*` empty + `warm_cache.json` absent
- [ ] **G-038** `@radix-ui/react-hover-card` installed unused — remove or use
- [ ] **G-040** `linkedHighlight` custom Set vs zustand — keep but wire
- [ ] **G-043** `ErrorBoundary retry` does not reset `queryClient`
- [ ] **G-044** `ChartPane.tsx` alias `ChartPanel` — doc only
- [ ] **G-045** `LayerToggles aviation/density` vs backend reject
- [ ] **G-046** `styles/tokens.ts` unused — wire test or remove
- [ ] **G-047** `HeatmapLayer.tsx` `count/p95` per-capacity
- [ ] **G-048** `VerdictPanel count<3` missing physical-stale message

## Next 8 PRs (order by blast radius)

| PR | Title | Gaps | Est |
|----|-------|------|-----|
| PR-1 | `feat/map-geo-layers` | G-001 G-002 G-006 G-012 G-042 G-045 | Half-day |
| PR-2 | `feat/map-history` | G-003 G-027 | Half-day |
| PR-3 | `feat/research-citations-resources` | G-007 G-008 G-009 | Full day |
| PR-4 | `feat/events-chain` + shell fix | G-004 G-005 G-017 | Half-day |
| PR-5 | `feat/contract-drift` + analytics | G-018 G-022 G-023 G-010 G-011 | Half-day |
| PR-6 | `feat/market-wireup` | G-014 G-015 G-016 G-020 G-039 G-019 | Full day |
| PR-7 | `feat/chart-polish` | G-028 G-034 G-048 G-026 G-042 | Half-day |
| PR-8 | `feat/perf-a11y-mobile` | G-024 G-025 G-035 G-036 G-037 G-038 G-030 G-031 | Full day |

## Merge Gates (run before every merge to main)

- [ ] `grep -rn "new WebSocket" src | wc -l` == `2`
- [ ] `grep -rn "from.*recharts\|from.*chart\.js" src | wc -l` == `0`
- [ ] `grep -c "MAX 3 MAP LAYERS" .opencode/plan/10*` == `3`
- [ ] `npm run test:contract` `serpapi_coverage` passes
- [ ] `npm run test:socket-kill` passes (WS kill → seed `stale:true`)
- [ ] `npm run bundlesize` <500KB (`vendor 80k map 180k chart 30k`)
- [ ] Visual QA at `520px` + `1440px` + `380px` (no overflow)
- [ ] Video 10s judge test: `engine/query/result_count/timestamp` + amber/zinc Cite distinct + `Uncertainty §9`

## File Inventory Quick Check

- [ ] `ls -R frontend/src` still `758` lines baseline (additions only, no deletions without RFC)
- [ ] `vite.config.js base:"/"` not `"./"`
- [ ] `backend/main.py:108 StaticFiles(html=True)` LAST after `/api/*` (SPA fallback)


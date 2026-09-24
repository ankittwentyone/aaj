# AAJ Terminal — Frontend

Zinc Terminal · Vite + React 19 + Tailwind v4 · Single-process FastAPI mount.

## Stack

| Dep | Version | Purpose |
|---|---|---|
| react / react-dom | 19.2.4 | UI |
| vite | 8.0.13 | Build (base:'/' — never './') |
| tailwindcss | 4.3.0 + @tailwindcss/vite | CSS-first `@import "tailwindcss"`, no tailwind.config churn |
| maplibre-gl | 5.5 | Vector map (Carto Dark Matter) |
| deck.gl | 9.1 + @deck.gl/* | Canvas layers (Scatterplot, Trips, Path, Arc) |
| lightweight-charts | 5.0.8 | Time-series (Area, Candle, Histogram) |
| @tanstack/react-query | 5 | REST cache (staleTime: Infinity, gcTime = bucket TTL) |
| lucide-react | 0.469 | Icons |
| zod | 3.23 | Contract validation |
| framer-motion | 12.23.12 | Isolated: MarketHome ticker + Research trace only (dynamic import) |
| @radix-ui/react-hover-card | 1.1 | Hover-card primitive only |

**Guardrails:** MAX 3 MAP LAYERS, MAX 2 VIZ ENGINES (lightweight-charts + deck.gl), MIN 520px chart width else sparkline fallback, ONE agent workspace. See `src/lib/guardrails.ts`.

## Structure (per 05 §8.1)

```
frontend/
├── index.html
├── vite.config.js           # base:'/', alias @, manualChunks {map,chart,vendor}, /api+/ws proxy
├── src/
│   ├── main.jsx             # createRoot + QueryClientProvider + BrowserRouter
│   ├── App.jsx              # Header + Routes + MOCK_MODE banner
│   ├── index.css            # Zinc tokens — single @theme, terminal-card, header 52px, risk-pill, pulse-bar, evidence hover
│   ├── api/
│   │   ├── client.js        # fetch* + QueryClient (gcTime §6) + WS_BASE
│   │   ├── queries.ts       # re-exports
│   │   ├── useMapWS.ts      # ONE writer per chokepoint — snapshot→diff merge
│   │   └── useResearchWS.ts # Research stream — trace + final report
│   ├── lib/
│   │   ├── utils.js / cn.ts # cn() clsx+twMerge
│   │   ├── staleTier.ts     # ONLY tier logic — fresh|amber|red
│   │   ├── ttls.ts          # TTL_S registry (mirrors cache.py:31)
│   │   ├── normalizeChart.ts / normalizeQuote.ts / summarizeEvidence.ts
│   │   ├── format.ts        # Intl Asia/Kolkata
│   │   ├── guardrails.ts    # MAX 3 / MAX 2 / MIN 520 / ONE workspace + SerpApi coverage
│   │   ├── serpapi/corroborate.ts # Every Δ paired with SerpApi chip
│   │   ├── linkedHighlight.ts # Cross-viz highlight store
│   │   └── analytics.ts     # __AAJ_TRACE ring 100
│   ├── components/
│   │   ├── ui/              # Dialog, Badge, EvidenceCard, CommandPalette
│   │   ├── Map/             # DeckOverlay (ONLY deck.gl import), MapView, ChokepointPanel, CrossingsChart, LayerToggles
│   │   ├── Asset/           # VerdictPanel, VerdictBar (div+CSS, no d3), ChartPanel, FilingsList
│   │   ├── Market/          # AnomalyStrip, TickerMarquee, IndexStrip
│   │   ├── Research/        # TracePanel, ReportView (rehype-sanitize)
│   │   ├── EvidenceChip.tsx
│   │   └── charts/ChartPane.tsx
│   ├── routes/              # MarketHome, AssetPage, WorldMapPage, EventsPage, CrossMarketPage, ResearchDesk, ErrorBoundary
│   ├── mocks/               # handlers.ts + browser.ts (MSW network-level)
│   └── styles/tokens.ts
└── public/geo/              # copied from backend/data/geo for dev
```

## Design Tokens (02)

`src/index.css` is 210 LOC, single `@theme`, NO `[data-theme="light"]`, NO `!important` for theming. Light lives only under `.marketing-shell` (for `/` marketing, not terminal). See `02_DESIGN_TOKENS.md`.

Key classes: `terminal-card` (glass 72% + blur 18px/sat 1.2 — only card + CmdK), `terminal-header` 52px, `risk-pill` 4 ramps, `pulse-bar`, `evidence-row` hover, `view-motion` 0.22s, `tabular-nums` global.

## Dev

```bash
npm install   # (heavy — run when ready)
npm run dev   # vite :5173 proxies /api+/ws to :8000
npm run build # vite build → dist/ (StaticFiles mounts it)
```

Env:

| Var | Default | Purpose |
|---|---|---|
| VITE_API_BASE | "" (same-origin) | API base (http://localhost:8000 in dev) |
| VITE_MOCK_MODE | false | Warm-cache demo banner + MSW |
| VITE_MAP_STYLE | Carto Dark Matter | MapLibre style |

## Backend Contract

10 REST + 2 WS at `backend/api/routes.py:9`. Frontend normalizes on read (see `src/lib/normalize*.ts`). `stale:true` always badges. `status:skipped` never crashes.

## CI Gates

- `grep -r "new WebSocket" src` === 2
- `grep -r "from.*@deck.gl" src` only in DeckOverlay.tsx
- `grep -r "framer-motion" src` only in TickerMarquee + TracePanel (dynamic)
- `grep -r "localStorage" src` only `aaj:` keys
- `grep -r "rehypeRaw" src` === 0
- `bundlesize` total <500KB gz

## Huge vs Bloat (Addendum)

- MAX 3 MAP LAYERS visible at once — `assertMapLayers` throws; UI toast denies 4th.
- MAX 2 VIZ ENGINES — lightweight-charts + deck.gl only; `d3` umbrella banned, micro-imports allowed if <5KB.
- MIN 520px chart width — `assertChartSize` fallback to sparkline/pill.
- ONE agent workspace — Research Drawer only.

If a PR violates caps, CI fails `HUGE_VS_BLOAT_GUARDRAIL`.

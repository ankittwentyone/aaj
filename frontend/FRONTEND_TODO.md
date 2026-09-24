# Frontend — in-depth improvement backlog

> Living list after UI recovery + instrument picker. Check off when shipped + tested.

## P0 — Usability (this sprint)

- [x] Replace rigid `<select>` with grouped **InstrumentPicker** (search, keyboard, prices)
- [x] **App.tsx** shell typed; `instrumentOptions.ts` for market-home shapes
- [ ] Map layer toggles: show active preset name in panel header
- [ ] Research: collapse Works cited by default (done); add “copy markdown” on report
- [ ] Command palette ↔ InstrumentPicker share search helpers

## P1 — Visual polish

- [ ] Markets home: featured chart height responsive; table sticky header on scroll
- [ ] Asset: single narrative column; filings table density
- [ ] Map: choke pills scroll-snap; mobile drawer handle
- [ ] Desk: trace lane progress bar (Discover 4/4) not only fraction text
- [ ] Cross: shock slider labels (−20% … +20%); instrument from context

## P2 — TypeScript migration

- [x] `App.tsx`, `instrumentOptions.ts`, `normalizeEvidence.ts`, `normalizeReportMarkdown.ts`
- [ ] `main.jsx` → `main.tsx`
- [ ] `api/client.js` → `client.ts` (align with `queries.ts`)
- [ ] Route pages: tighten props vs `FRONTEND_CONTRACT.md`

## P3 — Quality

- [ ] Playwright visual regression green at 380/520/1024/1440
- [ ] Contract tests for `/api/market-home` + research evidence shape
- [ ] Error boundaries: “Reload app” + cache-bust hint for stale `assets/*`
- [ ] a11y pass: focus trap on InstrumentPicker + CommandPalette

## P4 — Performance

- [ ] Map: optional dynamic import for deck only (keep single CSS bundle)
- [ ] React Query defaults per route (`TTL_S` audit)
- [ ] Warm `public/warm_cache.json` path documented in README_RUN

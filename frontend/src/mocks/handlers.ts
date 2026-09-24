import { http, HttpResponse } from "msw";

// TEST ONLY — MSW handlers for vitest/playwright. Never imported in production routes/components.
// Real app hits /api/* via Vite proxy to :8000 and WS /ws/* streaming. Handlers live under src/mocks/ only.
// Warm snapshot should be route-level JSON (what routes.py returns), not cache.py bucket keys.
// If /warm_cache.json exists (scripts/warm_cache.py recording), handlers hydrate from it; else degraded stubs.
let warm: any = null;
try {
  // warm_cache.json is OPTIONAL — present only after `MOCK_MODE=false python scripts/warm_cache.py`
  // Frontend MSW uses fetch fallback if file absent.
  warm = null;
} catch {}

export const handlers = [
  http.get("/api/market-home", async () => {
    if (warm?.marketHome) return HttpResponse.json(warm.marketHome);
    // Try fetch from /warm_cache.json static if present (vite public)
    try {
      const r = await fetch("/warm_cache.json");
      if (r.ok) {
        const j = await r.json();
        // backend warm_cache shape is { serpapi: {}, av: {}, ... } — not route-level.
        // Route-level warm cache would be in /mock/home.json; fall through to stub.
        if (j.marketHome) return HttpResponse.json(j.marketHome);
      }
    } catch {}
    return HttpResponse.json({
      indices: {
        SPX: { payload: { "Global Quote": { "05. price": "4521.50", "10. change percent": "+0.42%" } }, stale: false },
        NDX: { payload: { "Global Quote": { "05. price": "15890.11", "10. change percent": "+0.91%" } }, stale: false },
      },
      commodities: {
        BRENT: { payload: { price: "82.31", change_pct: "+1.2%" }, stale: false },
        WTI: { payload: { price: "78.44", change_pct: "+0.9%" }, stale: false },
      },
      fx: { EURUSD: { payload: { price: "1.0821" } }, USDINR: { payload: { price: "83.12" } } },
      rates: { payload: { value: "4.21%" } },
      event_ticker: [{ payload: { title: "BRENT holds $82 on Hormuz watch" } }],
      anomaly_strip: { max_chokepoint_anomaly: { id: "hormuz", pct_change: 4.2, stale: false, retrieved_at: new Date().toISOString() }, news_count: 8 },
      evidence: [{ provider: "serpapi", dataset: "google_news", query: "markets today", retrieved_at: new Date().toISOString() }],
    });
  }),
  http.get("/api/asset/:ticker", ({ params }) => HttpResponse.json({
    ticker: params.ticker,
    quote: { payload: { price: "82.31" } },
    chart: { rows: Array.from({ length: 30 }, (_, i) => ({ ts: String(i + 1), close: 80 + Math.sin(i / 5) * 2 + i * 0.05, volume: 1_000_000 + Math.random() * 500_000 })), tail: [] },
    physical_vs_narrative: { price_delta_pct: 2.1, physical_delta_pct: 6.8, verdict: "PHYSICAL" },
    filings: [{ form: "10-K", title: "Annual Report" }],
    insider: [{ owner: "J. Doe", transactionType: "Buy" }],
    evidence: [{ provider: "serpapi", dataset: "google_trends", query: String(params.ticker), retrieved_at: new Date().toISOString() }],
  })),
  http.get("/api/map", () => HttpResponse.json({
    boxes: [
      { id: "hormuz", name: "Strait of Hormuz", count: 142, baseline_7d: 128, pct_change: 10.9, stale: false, retrieved_at: new Date().toISOString(), bbox: [[24.5, 55.5], [27.0, 57.5]] },
      { id: "suez", name: "Suez Canal", count: 98, baseline_7d: 102, pct_change: -3.9, stale: false, retrieved_at: new Date().toISOString(), bbox: [[27.5, 32.0], [31.8, 34.0]] },
    ],
  })),
  http.get("/api/map/:id", ({ params }) => HttpResponse.json({
    id: params.id,
    count: 142,
    baseline_7d: 128,
    pct_change: 10.9,
    stale: false,
    positions: Array.from({ length: 12 }, (_, i) => ({ mmsi: `4${i}00000${i}`, lat: 26 + Math.random(), lon: 56 + Math.random(), sog: 12 + Math.random() * 6, cog: Math.random() * 360, type: i % 3 === 0 ? "tanker" : "cargo", owner: i % 2 ? "Maersk" : "MSC", commodity: i % 2 ? "BRENT" : "WTI" })),
    retrieved_at: new Date().toISOString(),
  })),
  http.get("/api/map/:id/history", () => HttpResponse.json({ counts: Array.from({ length: 48 }, () => 90 + Math.floor(Math.random() * 40)), crossings: Array.from({ length: 48 }, () => 5 + Math.floor(Math.random() * 8)), positions: [{ sog: 14 }, { sog: 8 }] })),
  http.get("/api/events", () => HttpResponse.json({ clusters: [{ title: "Hormuz tension lifts BRENT" }, { title: "Suez traffic normal" }], count: 2, evidence: [{ provider: "serpapi", dataset: "google_news" }] })),
  http.get("/api/events/:id/chain", ({ params }) => HttpResponse.json({ id: params.id, chain: [{ title: "upstream: Hormuz delay" }], evidence: [{ provider: "serpapi", dataset: "google_search" }] })),
  http.get("/api/cross-market", () => HttpResponse.json({
    matrix: { BRENT: { XLE: 0.82, XLI: 0.41, XLK: -0.12 }, WTI: { XLE: 0.76, XLI: 0.38 } },
    candidate_edges: [{ from: "BRENT", to: "XLE", weight: 0.82, dashed: true, rationale: "SerpApi: energy sensitivity" }],
    evidence: [{ provider: "serpapi", dataset: "google_search", query: "BRENT impact sectors" }],
  })),
  http.post("/api/cross-market/simulate", async ({ request }) => {
    const body: any = await request.json().catch(() => ({}));
    const v = body.shock_value ?? 10;
    return HttpResponse.json({
      shock_asset: body.shock_asset ?? "BRENT",
      shock_value: v,
      exposures: [
        { target: "XLE", exposure: v * 0.82, weight: 0.82, rationale: "direct energy beta" },
        { target: "XLI", exposure: v * 0.41, weight: 0.41, rationale: " industrials via fuel cost" },
        { target: "XLK", exposure: v * -0.12, weight: 0.12, rationale: "tech inverse" },
      ],
      exposed_chokepoints: v > 5 ? ["hormuz"] : [],
      evidence: [{ provider: "serpapi", dataset: "google_search", query: "BRENT impact" }],
    });
  }),
  http.get("/api/search", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    return HttpResponse.json({ query: q, results: [{ label: q || "BRENT", type: "asset", route: `/asset/${encodeURIComponent(q || "BRENT")}` }] });
  }),
  http.post("/api/research/run", async ({ request }) => {
    const body: any = await request.json().catch(() => ({}));
    return HttpResponse.json({ report: `# Research: ${body.query ?? "why"}\n\nSerpApi-backed synthesis stub.`, evidence_count: 3, evidence: [{ provider: "serpapi", dataset: "google_news", query: body.query, retrieved_at: new Date().toISOString() }] });
  }),
  http.get("/api/geo/:layer", () => HttpResponse.json({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [55.5, 26.2] }, properties: { name: "Mock Port" } }] })),
  http.get("/api/map/layers/:feed", () => HttpResponse.json({ type: "FeatureCollection", features: [] })),
  http.get("/warm_cache.json", () => HttpResponse.json({ _note: "warm_cache.json served via MSW stub — run scripts/warm_cache.py live for real recording", serpapi: {}, av: {} })),
];

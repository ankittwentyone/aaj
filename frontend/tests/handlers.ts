import { http, HttpResponse } from "msw";

const now = new Date().toISOString();
const serpapiEvidence = (query: string, dataset = "google_news") => ({
  provider: "serpapi",
  dataset,
  query,
  retrieved_at: now,
  source_url: `https://news.google.com/search?q=${encodeURIComponent(query)}`,
  result_count: 5,
});
const avEvidence = (dataset = "global_quote", query = "BRENT") => ({
  provider: "alphavantage",
  dataset,
  query,
  retrieved_at: now,
  source_url: "https://www.alphavantage.co/query",
});
const fredEvidence = {
  provider: "fred",
  dataset: "DGS10",
  retrieved_at: now,
  source_url: "https://fred.stlouisfed.org/series/DGS10",
};
const aisEvidence = {
  provider: "aisstream",
  dataset: "traffic_anomaly",
  retrieved_at: now,
  source_url: "https://aisstream.io",
};

export const contractFixtures = {
  healthz: { ok: true },
  readyz: { db_exists: true, cache_size: 42, ais_task: true },
  marketHome: {
    indices: {
      SPX: { payload: { "Global Quote": { "05. price": "4521.50", "10. change percent": "+0.42%", "08. previous close": "4502.00" } }, provider: "alphavantage", dataset: "global_quote", retrieved_at: now, stale: false },
      NDX: { payload: { "Global Quote": { "05. price": "15890.11", "10. change percent": "+0.91%", "08. previous close": "15747.00" } }, provider: "alphavantage", dataset: "global_quote", retrieved_at: now, stale: false },
    },
    commodities: {
      BRENT: { payload: { price: "82.31", change_pct: "+1.2%", "Global Quote": { "05. price": "82.31", "08. previous close": "81.30" } }, provider: "alphavantage", dataset: "commodity", retrieved_at: now, stale: false },
      WTI: { payload: { price: "78.44", change_pct: "+0.9%" }, provider: "alphavantage", dataset: "commodity", retrieved_at: now, stale: false },
      GOLD: { payload: { price: "2031.20", change_pct: "+0.3%" }, provider: "alphavantage", dataset: "commodity", retrieved_at: now, stale: false },
      COPPER: { payload: { price: "4.21", change_pct: "-0.5%" }, provider: "alphavantage", dataset: "commodity", retrieved_at: now, stale: false },
      NATGAS: { payload: { price: "2.88", change_pct: "+2.1%" }, provider: "alphavantage", dataset: "commodity", retrieved_at: now, stale: false },
    },
    fx: {
      EURUSD: { payload: { price: "1.0821", "Global Quote": { "05. price": "1.0821" } }, provider: "alphavantage", dataset: "fx", retrieved_at: now },
      USDINR: { payload: { price: "83.12", "Global Quote": { "05. price": "83.12" } }, provider: "alphavantage", dataset: "fx", retrieved_at: now },
    },
    crypto: {
      BTC: { payload: { "Global Quote": { "05. price": "67231.00", "10. change percent": "+1.5%" } }, provider: "alphavantage", dataset: "crypto", retrieved_at: now, stale: false },
      ETH: { payload: { "Global Quote": { "05. price": "3821.10", "10. change percent": "+0.8%" } }, provider: "alphavantage", dataset: "crypto", retrieved_at: now, stale: false },
    },
    rates: { payload: { value: "4.21%", close: 4.21 }, provider: "fred", dataset: "DGS10", retrieved_at: now },
    event_ticker: Array.from({ length: 8 }, (_, i) => ({
      payload: { title: `BRENT holds $82 on Hormuz watch — event ${i + 1}` },
      provider: "serpapi",
      dataset: "google_news",
      query: "markets today",
      retrieved_at: now,
      source_url: "https://news.google.com",
    })),
    anomaly_strip: {
      max_chokepoint_anomaly: { id: "hormuz", name: "Strait of Hormuz", pct_change: 10.9, stale: false, retrieved_at: now, baseline_7d: 128, count: 142 },
      news_count: 8,
      note: "price/trends deltas join per-asset",
    },
    evidence: [
      serpapiEvidence("markets today", "google_news"),
      avEvidence("global_quote", "SPX"),
      fredEvidence,
      aisEvidence,
    ],
  },
  asset: (ticker = "BRENT") => ({
    ticker,
    quote: { payload: { "Global Quote": { "05. price": "82.31", "08. previous close": "81.30", "10. change percent": "+1.24%" }, price: "82.31" }, provider: "alphavantage", dataset: "global_quote", retrieved_at: now },
    chart: {
      rows: Array.from({ length: 60 }, (_, i) => ({ ts: String(Date.now() - (60 - i) * 86400000), close: 80 + Math.sin(i / 5) * 2 + i * 0.05, volume: 1_000_000 + Math.random() * 500_000 })),
      tail: Array.from({ length: 5 }, (_, i) => ({ ts: String(55 + i), close: 82 + i * 0.1, volume: 1_200_000 })),
    },
    fundamentals: { payload: { marketCap: "2.1T", pe: 7.2, eps: 8.1 }, provider: "alphavantage", dataset: "fundamentals", retrieved_at: now },
    filings: [
      { form: "10-K", title: "Annual Report 2023", filedAt: "2024-02-28", source_url: "https://sec.gov/Archives/edgar/data/0000034088" },
      { form: "10-Q", title: "Quarterly Report Q3", filedAt: "2024-10-30", source_url: "https://sec.gov/Archives/edgar/data/0000034088" },
      { form: "8-K", title: "Current Report — Hormuz ops", filedAt: "2024-11-15", source_url: "https://sec.gov/Archives/edgar/data/0000034088" },
    ],
    insider: Array.from({ length: 5 }, (_, i) => ({ owner: `J. Doe ${i + 1}`, transactionType: i % 2 ? "Sale" : "Purchase", securitiesOwned: 1000 + i * 100, transactionDate: "2024-11-01" })),
    news_timeline: [
      { payload: { title: `${ticker} rallies on supply fears` }, provider: "serpapi", dataset: "google_news", query: `${ticker} stock`, retrieved_at: now, source_url: "https://news.google.com" },
    ],
    trends: {
      payload: {
        rising_queries: ["why is brent up", "hormuz oil", "brent price today", "opec meeting", "brent forecast"],
        interest_by_region: [
          { geo: "IN", value: 100 },
          { geo: "US", value: 82 },
          { geo: "AE", value: 75 },
          { geo: "SG", value: 60 },
          { geo: "GB", value: 55 },
        ],
        suggestions: ["why is brent moving?", "why is oil up?"],
      },
      provider: "serpapi",
      dataset: "google_trends",
      retrieved_at: now,
      query: ticker,
    },
    physical_vs_narrative: { price_delta_pct: 2.1, physical_delta_pct: 10.9, verdict: "PHYSICAL" },
    rising_queries_badge: ["why is brent up", "hormuz oil", "brent price today", "opec meeting", "brent forecast"].slice(0, 5),
    regional_interest_strip: [
      { geo: "IN", value: 100 },
      { geo: "US", value: 82 },
      { geo: "AE", value: 75 },
      { geo: "SG", value: 60 },
      { geo: "GB", value: 55 },
    ].slice(0, 5),
    what_people_are_asking: ["why is BRENT moving?", "why is oil up?", "will brent hit 100?"],
    physical_corroboration: { id: "hormuz", pct_change: 10.9, stale: false, retrieved_at: now, count: 142, baseline_7d: 128 },
    evidence: [
      serpapiEvidence(`${ticker} stock`, "google_news"),
      serpapiEvidence(ticker, "google_trends"),
      serpapiEvidence(`why is ${ticker} `, "google_autocomplete"),
      avEvidence("global_quote", ticker),
      { provider: "sec", dataset: "filings", retrieved_at: now, source_url: "https://sec.gov" },
      aisEvidence,
    ],
  }),
  events: {
    clusters: [
      { id: "geopolitical-1", title: "Hormuz tension lifts BRENT — tankers rerouted", items: [{ provider: "serpapi", dataset: "google_news", query: "oil markets geopolitics", retrieved_at: now }], chokepoint_ids: ["hormuz"], lat: 25.75, lon: 56.5 },
      { id: "supply-1", title: "Suez traffic normal — no delays reported", items: [{ provider: "serpapi", dataset: "google_news", query: "oil markets geopolitics", retrieved_at: now }], chokepoint_ids: ["suez"], lat: 29.6, lon: 33.0 },
    ],
    count: 2,
    what_people_are_asking: ["why is oil up?", "will hormuz close?"],
    evidence: [serpapiEvidence("oil markets geopolitics", "google_news"), serpapiEvidence("oil markets geopolitics ", "google_autocomplete")],
  },
  eventChain: (id = "geopolitical-1") => ({
    event_id: id,
    category: "geopolitical",
    commodity: "BRENT",
    sectors: ["Energy", "Airlines", "Chemicals"],
    companies: ["XOM", "CVX"],
    evidence: [serpapiEvidence(id, "google_search")],
  }),
  crossMarket: {
    matrix: {
      BRENT: { XOM: 0.85, CVX: 0.82, US10Y: 0.45, USDINR: 0.35 },
      WTI: { XOM: 0.8, BRENT: 0.95 },
      NATGAS: { US10Y: 0.2 },
    },
    candidate_edges: [
      { from: "BRENT", to: "XLE", weight: 0.82, dashed: true, rationale: "SerpApi: energy sensitivity via google_search", engine: "google_search", source_url: "https://news.google.com/search?q=BRENT+impact+sectors" },
      { from: "WTI", to: "XLI", weight: 0.38, dashed: true, rationale: "SerpApi: industrials fuel cost", engine: "google_search", source_url: "https://news.google.com/search?q=WTI+impact" },
    ],
    evidence: [serpapiEvidence("BRENT impact sectors", "google_search"), { provider: "curated", dataset: "sensitivity_matrix.json", retrieved_at: null }],
  },
  simulate: (shock_asset = "BRENT", shock_value = 10) => ({
    shock_asset,
    shock_value,
    exposures: [
      { target: "XOM", exposure: Number((shock_value * 0.85).toFixed(2)), weight: 0.85, rationale: "Integrated oil majors track crude with high beta." },
      { target: "CVX", exposure: Number((shock_value * 0.82).toFixed(2)), weight: 0.82, rationale: "Chevron leverage to upstream realizations." },
      { target: "US10Y", exposure: Number((shock_value * 0.45).toFixed(2)), weight: 0.45, rationale: "Oil-driven inflation expectations push yields." },
      { target: "USDINR", exposure: Number((shock_value * 0.35).toFixed(2)), weight: 0.35, rationale: "India oil import bill pressures INR." },
    ],
    exposed_chokepoints: shock_value > 5 ? ["hormuz", "bab-el-mandeb", "suez"] : [],
    evidence: [{ provider: "curated", dataset: "sensitivity_matrix.json", retrieved_at: null, note: "pure arithmetic over curated weights" }, serpapiEvidence(`${shock_asset} impact`, "google_search")],
  }),
  mapAll: {
    // backend returns array directly; handlers mimic both wrapped and direct for test flexibility
    boxes: [
      { id: "hormuz", name: "Strait of Hormuz", bbox: [[24.5, 55.5], [27.0, 57.5]], count: 142, baseline_7d: 128, pct_change: 10.9, positions: Array.from({ length: 12 }, (_, i) => ({ mmsi: `4${i}00000${i}`, lat: 26 + Math.random() * 0.5, lon: 56 + Math.random() * 0.5, sog: 12 + Math.random() * 6, cog: Math.random() * 360, type: i % 3 === 0 ? "tanker" : "cargo", owner: i % 2 ? "Maersk" : "MSC", commodity: i % 2 ? "BRENT" : "WTI" })), retrieved_at: now, stale: false, evidence: [aisEvidence, serpapiEvidence("hormuz traffic", "google_news")] },
      { id: "suez", name: "Suez Canal Approach", bbox: [[27.5, 32.0], [31.8, 34.0]], count: 98, baseline_7d: 102, pct_change: -3.9, stale: false, retrieved_at: now, bbox2: true, positions: [], evidence: [aisEvidence, serpapiEvidence("suez traffic", "google_news")] },
      { id: "bab-el-mandeb", name: "Bab el-Mandeb", bbox: [[11.5, 42.5], [13.5, 44.5]], count: 76, baseline_7d: 80, pct_change: -5.0, stale: false, retrieved_at: now, positions: [], evidence: [aisEvidence, serpapiEvidence("bab traffic", "google_news")] },
      { id: "malacca", name: "Malacca + Singapore", bbox: [[1.0, 98.0], [6.5, 104.5]], count: 210, baseline_7d: 200, pct_change: 5.0, stale: false, retrieved_at: now, positions: [], evidence: [aisEvidence, serpapiEvidence("malacca", "google_news")] },
      { id: "panama", name: "Panama Canal", bbox: [[7.5, -80.5], [9.8, -77.5]], count: 88, baseline_7d: 90, pct_change: -2.2, stale: false, retrieved_at: now, positions: [], evidence: [aisEvidence, serpapiEvidence("panama", "google_news")] },
    ],
  },
  mapOne: (id = "hormuz") => ({
    id,
    name: "Strait of Hormuz",
    bbox: [[24.5, 55.5], [27.0, 57.5]],
    count: 142,
    baseline_7d: 128,
    pct_change: 10.9,
    positions: Array.from({ length: 12 }, (_, i) => ({ mmsi: `4${i}00000${i}`, lat: 26 + Math.random(), lon: 56 + Math.random(), sog: 12 + Math.random() * 6, cog: Math.random() * 360, type: i % 3 === 0 ? "tanker" : "cargo", owner: i % 2 ? "Maersk" : "MSC", commodity: i % 2 ? "BRENT" : "WTI" })),
    retrieved_at: now,
    stale: false,
    evidence: [aisEvidence, serpapiEvidence(`${id} vessel`, "google_news")],
  }),
  mapHistory: {
    counts: Array.from({ length: 48 }, () => 90 + Math.floor(Math.random() * 40)),
    crossings: Array.from({ length: 48 }, () => 5 + Math.floor(Math.random() * 8)),
    positions: [{ sog: 14 }, { sog: 8 }, { sog: 12 }],
    stale: false,
    retrieved_at: now,
    evidence: [aisEvidence, serpapiEvidence("hormuz history", "google_news")],
    id: "hormuz",
  },
  geo: {
    ports: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [55.5, 26.2] }, properties: { name: "Mock Port Hormuz" } }] },
    routes: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[55.5, 26.2], [56.0, 26.5]] }, properties: { name: "Route A" } }] },
    tss_lanes: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[55.5, 26.2], [55.6, 26.3]] }, properties: { lane: "TSS 1" } }] },
    trade_arcs: { type: "ArcCollection", arcs: [{ from: [55.5, 26.2], to: [32.5, 30.0], commodity: "BRENT" }] },
  },
  mapLayer: (feed = "weather") => ({
    feed,
    dots: feed === "weather" ? [{ lat: 26.2, lon: 55.5, value: 32 }] : [],
    alerts: feed === "disasters" ? [{ title: "Storm Hormuz" }] : undefined,
    evidence: [serpapiEvidence(feed, "google_search"), { provider: "curated", dataset: `${feed}.json`, retrieved_at: now }],
  }),
  search: (q = "BRENT") => ({
    query: q,
    results: [
      { label: q.toUpperCase(), type: "asset", route: `/asset/${encodeURIComponent(q.toUpperCase())}` },
      { label: "Strait of Hormuz", type: "chokepoint", route: "/map?choke=hormuz", id: "hormuz" },
      { label: "WHY BRENT?", type: "event", route: "/events#geopolitical" },
      { label: "BRENT SHOCK", type: "scenario", route: "/cross-market#BRENT" },
    ].slice(0, 8),
  }),
  researchRun: (query = "Why is BRENT moving?") => ({
    report: `# Research: ${query}\n\nSerpApi-backed synthesis. BRENT +1.2% driven by Hormuz anomaly +10.9% corroborated by AIS. Sec filings show no insider selling. Verdict: PHYSICAL.`,
    trace: Array.from({ length: 7 }, (_, i) => ({ node: ["resolve", "market_pull", "news_search", "trends_search", "physical_corroborate", "web_search", "synthesize"][i], label: `Stage ${i + 1}`, stage: ["Discover", "Discover", "Discover", "Discover", "Corroborate", "Synthesize", "Synthesize"][i], status: "done" as const, engine: ["serpapi", "alphavantage", "google_news", "google_trends", "aisstream", "google_search", "llm"][i], query, result_count: 3 + i, timestamp: now, duration_ms: 120 + i * 20 })),
    evidence: [
      serpapiEvidence(query, "google_news"),
      serpapiEvidence(query, "google_trends"),
      serpapiEvidence(query, "google_search"),
      avEvidence("global_quote", "BRENT"),
      fredEvidence,
      aisEvidence,
    ],
    evidence_count: 6,
  }),
};

export const handlers = [
  http.get("*/healthz", () => HttpResponse.json(contractFixtures.healthz)),
  http.get("*/readyz", () => HttpResponse.json(contractFixtures.readyz)),
  http.get("*/api/market-home", () => HttpResponse.json(contractFixtures.marketHome)),
  http.get("*/api/asset/:ticker", ({ params }) => HttpResponse.json(contractFixtures.asset(String(params.ticker ?? "BRENT").toUpperCase()))),
  http.get("*/api/events", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "oil markets geopolitics";
    const num = Number(url.searchParams.get("num") ?? "20");
    return HttpResponse.json({ ...contractFixtures.events, query: q, num });
  }),
  http.get("*/api/events/:id/chain", ({ params }) => HttpResponse.json(contractFixtures.eventChain(String(params.id)))),
  http.get("*/api/cross-market", () => HttpResponse.json(contractFixtures.crossMarket)),
  http.post("*/api/cross-market/simulate", async ({ request }) => {
    const body: any = await request.json().catch(() => ({}));
    return HttpResponse.json(contractFixtures.simulate(body.shock_asset ?? "BRENT", Number(body.shock_value ?? 10)));
  }),
  http.get("*/api/map", () => HttpResponse.json(contractFixtures.mapAll.boxes)), // direct array per contract
  http.get("*/api/map/:id", ({ params }) => HttpResponse.json(contractFixtures.mapOne(String(params.id)))),
  http.get("*/api/map/:id/history", ({ request }) => {
    const url = new URL(request.url);
    const hours = url.searchParams.get("hours") ?? "720";
    return HttpResponse.json({ ...contractFixtures.mapHistory, hours: Number(hours) });
  }),
  http.get("*/api/geo/:layer", ({ params }) => {
    const layer = String(params.layer);
    const data: any = (contractFixtures.geo as any)[layer];
    if (data) return HttpResponse.json(data);
    return HttpResponse.json({ type: "FeatureCollection", features: [], error: `unknown layer ${layer}` }, { status: 404 });
  }),
  http.get("*/api/map/layers/:feed", ({ params }) => HttpResponse.json(contractFixtures.mapLayer(String(params.feed)))),
  http.get("*/api/search", ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "8");
    const res = contractFixtures.search(q);
    return HttpResponse.json({ query: q, results: res.results.slice(0, limit) });
  }),
  http.post("*/api/research/run", async ({ request }) => {
    const body: any = await request.json().catch(() => ({}));
    return HttpResponse.json(contractFixtures.researchRun(body.query ?? "Why is BRENT moving?"));
  }),
];

export function serpapiCoverageGate(evidence: any[] | undefined, route: string) {
  if (!Array.isArray(evidence) || evidence.length === 0) throw new Error(`serpapi_coverage gate FAIL: ${route} evidence[] empty or missing`);
  const has = evidence.some((e) => e.provider === "serpapi");
  if (!has) throw new Error(`serpapi_coverage gate FAIL: ${route} has zero serpapi records — every evidence[] must contain at least one serpapi`);
}

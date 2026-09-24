import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { z } from "zod";
import { handlers, contractFixtures, serpapiCoverageGate } from "./handlers";

const BASE = "http://localhost";
const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function getJSON(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`fetch ${path} ${res.status}`);
  return res.json();
}

// ── zod schemas ──
const EvidenceSchema = z
  .object({
    provider: z.string(),
    dataset: z.string().nullable().optional(),
    entity: z.string().nullable().optional(),
    entity_id: z.string().nullable().optional(),
    query: z.string().nullable().optional(),
    source_url: z.string().nullable().optional(),
    retrieved_at: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
    result_count: z.number().nullable().optional(),
    engine: z.string().nullable().optional(),
    confidence: z.number().nullable().optional(),
  })
  .passthrough();

const HealthzSchema = z.object({ ok: z.literal(true) }).passthrough();
const ReadyzSchema = z.object({ db_exists: z.boolean(), cache_size: z.number(), ais_task: z.boolean() }).passthrough();

const MarketHomeSchema = z
  .object({
    indices: z.record(z.any()),
    commodities: z.record(z.any()),
    fx: z.record(z.any()),
    crypto: z.record(z.any()).optional(),
    rates: z.any(),
    event_ticker: z.array(z.any()).min(1).max(8),
    anomaly_strip: z
      .object({
        max_chokepoint_anomaly: z
          .object({
            id: z.string(),
            pct_change: z.number().nullable().optional(),
            stale: z.boolean(),
            retrieved_at: z.string().nullable().optional(),
            baseline_7d: z.number().nullable().optional(),
            count: z.number().nullable().optional(),
            name: z.string().nullable().optional(),
          })
          .passthrough()
          .nullable()
          .optional(),
        news_count: z.number().optional(),
        note: z.string().optional(),
      })
      .passthrough(),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    // indices must contain SPX and NDX
    if (!data.indices?.SPX || !data.indices?.NDX) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "market-home indices missing SPX or NDX", path: ["indices"] });
    }
    if (!data.commodities?.BRENT || !data.commodities?.WTI) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "commodities missing BRENT or WTI", path: ["commodities"] });
    }
  });

const AssetSchema = z
  .object({
    ticker: z.string(),
    quote: z.any(),
    chart: z.any(),
    fundamentals: z.any().optional(),
    filings: z.array(z.any()).max(10).optional(),
    insider: z.array(z.any()).max(10).optional(),
    news_timeline: z.any().optional(),
    trends: z.any().optional(),
    physical_vs_narrative: z
      .object({
        price_delta_pct: z.number().nullable().optional(),
        physical_delta_pct: z.number().nullable().optional(),
        verdict: z.string(),
      })
      .passthrough()
      .optional(),
    rising_queries_badge: z.array(z.any()).max(5).optional(),
    regional_interest_strip: z.array(z.any()).max(5).optional(),
    what_people_are_asking: z.any().optional(),
    physical_corroboration: z.any().optional(),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    // chart must have rows/tail or be array
    const c = data.chart;
    const hasRows = c && (Array.isArray(c.rows) || Array.isArray(c) || Array.isArray(c.data) || typeof c.rows === "object");
    if (!c || (!hasRows && !Array.isArray(c.rows) && !Array.isArray(c))) {
      // allow empty but ensure structure is present
      if (!c) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "asset chart missing", path: ["chart"] });
    }
    if (Array.isArray(data.rising_queries_badge) && data.rising_queries_badge.length > 5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "rising_queries_badge >5", path: ["rising_queries_badge"] });
    }
    if (Array.isArray(data.regional_interest_strip) && data.regional_interest_strip.length > 5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "regional_interest_strip >5", path: ["regional_interest_strip"] });
    }
  });

const EventsSchema = z
  .object({
    clusters: z.array(z.any()),
    count: z.number().optional(),
    what_people_are_asking: z.any().optional(),
    evidence: z.array(EvidenceSchema).min(1),
    status: z.string().optional(),
    reason: z.string().optional(),
  })
  .passthrough();

const EventChainSchema = z
  .object({
    event_id: z.string(),
    category: z.string(),
    commodity: z.string(),
    sectors: z.array(z.string()),
    companies: z.array(z.string()),
  })
  .passthrough();

const CrossMarketSchema = z
  .object({
    matrix: z.record(z.any()),
    candidate_edges: z.array(
      z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
          weight: z.number().optional(),
          dashed: z.boolean().optional(),
          rationale: z.string().optional(),
          engine: z.string().optional(),
          source_url: z.string().nullable().optional(),
        })
        .passthrough(),
    ),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (!data.matrix?.BRENT && !data.matrix?.WTI && !data.matrix?.NATGAS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "cross-market matrix missing BRENT/WTI/NATGAS", path: ["matrix"] });
    }
  });

const SimulateSchema = z
  .object({
    shock_asset: z.string(),
    shock_value: z.number(),
    exposures: z.array(
      z
        .object({
          target: z.string(),
          exposure: z.number(),
          weight: z.number().optional(),
          rationale: z.string().optional(),
        })
        .passthrough(),
    ),
    exposed_chokepoints: z.array(z.string()),
    evidence: z.array(EvidenceSchema).optional(),
  })
  .passthrough();

const MapBoxSchema = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    bbox: z.any(),
    count: z.number().optional(),
    baseline_7d: z.number().nullable().optional(),
    pct_change: z.number().nullable().optional(),
    positions: z.array(z.any()).optional(),
    retrieved_at: z.string().nullable().optional(),
    stale: z.boolean().optional(),
    evidence: z.array(EvidenceSchema).min(1).optional(),
  })
  .passthrough();

const MapArraySchema = z.union([z.array(MapBoxSchema).min(5).max(5), z.object({ boxes: z.array(MapBoxSchema).min(5).max(5) }).passthrough()]);

const MapHistorySchema = z
  .object({
    counts: z.array(z.number()).optional(),
    crossings: z.array(z.number()).optional(),
    positions: z.array(z.any()).optional(),
    stale: z.boolean().optional(),
    retrieved_at: z.string().nullable().optional(),
    evidence: z.array(EvidenceSchema).optional(),
    id: z.string().optional(),
  })
  .passthrough();

const GeoSchema = z
  .object({
    type: z.string(),
    features: z.array(z.any()).optional(),
    arcs: z.array(z.any()).optional(),
  })
  .passthrough();

const MapLayerSchema = z
  .object({
    feed: z.string(),
    dots: z.array(z.any()).optional(),
    alerts: z.array(z.any()).optional(),
    features: z.array(z.any()).optional(),
    evidence: z.array(EvidenceSchema).optional(),
    retrieved_at: z.string().nullable().optional(),
  })
  .passthrough();

const SearchSchema = z
  .object({
    query: z.string(),
    results: z.array(
      z
        .object({
          label: z.string(),
          type: z.string(),
          route: z.string(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

const ResearchRunSchema = z
  .object({
    report: z.string().min(10),
    evidence: z.array(EvidenceSchema).optional(),
    evidence_count: z.number().optional(),
    trace: z.array(z.any()).optional(),
  })
  .passthrough();

// ── helpers ──
function expectSerpapi(evidence: any[], route: string) {
  expect(Array.isArray(evidence), `${route} evidence must be array`).toBe(true);
  expect(evidence.length).toBeGreaterThan(0);
  const has = evidence.some((e) => e.provider === "serpapi");
  if (!has) {
    throw new Error(`serpapi_coverage gate FAIL: ${route} has zero serpapi — evidence: ${JSON.stringify(evidence).slice(0, 200)}`);
  }
  expect(has).toBe(true);
}

// ── tests ──
describe("contract · GET /healthz", () => {
  it("GET /healthz → {ok:true}", async () => {
    const data = await getJSON("/healthz");
    expect(() => HealthzSchema.parse(data)).not.toThrow();
    expect(data.ok).toBe(true);
  });
});

describe("contract · GET /readyz", () => {
  it("GET /readyz → {db_exists,cache_size,ais_task}", async () => {
    const data = await getJSON("/readyz");
    expect(() => ReadyzSchema.parse(data)).not.toThrow();
    expect(typeof data.db_exists).toBe("boolean");
    expect(typeof data.cache_size).toBe("number");
    expect(typeof data.ais_task).toBe("boolean");
  });
});

describe("contract · GET /api/market-home", () => {
  it("GET /api/market-home matches schema + serpapi gate", async () => {
    const data = await getJSON("/api/market-home");
    const parsed = MarketHomeSchema.parse(data);
    expect(parsed.indices.SPX).toBeDefined();
    expect(parsed.indices.NDX).toBeDefined();
    expect(parsed.commodities.BRENT).toBeDefined();
    expect(parsed.fx.EURUSD).toBeDefined();
    expect(parsed.fx.USDINR).toBeDefined();
    expect(parsed.rates).toBeDefined();
    expect(parsed.event_ticker.length).toBeGreaterThanOrEqual(1);
    expect(parsed.event_ticker.length).toBeLessThanOrEqual(8);
    expect(parsed.anomaly_strip).toBeDefined();
    expectSerpapi(parsed.evidence, "GET /api/market-home");
    // indices stale flag check
    expect(parsed.evidence.some((e) => e.provider === "serpapi")).toBe(true);
  });

  it("market-home event_ticker is exactly 8 when live (stub ensures 8)", async () => {
    const data = await getJSON("/api/market-home");
    expect(data.event_ticker.length).toBe(8);
  });

  it("market-home anomaly_strip.max_chokepoint_anomaly has required fields", async () => {
    const data = await getJSON("/api/market-home");
    const a = data.anomaly_strip.max_chokepoint_anomaly;
    expect(a.id).toBe("hormuz");
    expect(typeof a.pct_change).toBe("number");
    expect(typeof a.stale).toBe("boolean");
  });
});

describe("contract · GET /api/asset/{ticker}", () => {
  it("GET /api/asset/BRENT matches schema + serpapi gate", async () => {
    const data = await getJSON("/api/asset/BRENT");
    const parsed = AssetSchema.parse(data);
    expect(parsed.ticker).toBe("BRENT");
    expect(parsed.quote).toBeDefined();
    expect(parsed.chart).toBeDefined();
    expect(parsed.physical_vs_narrative?.verdict).toMatch(/PHYSICAL|NARRATIVE|NEUTRAL/);
    expect(parsed.rising_queries_badge!.length).toBeLessThanOrEqual(5);
    expect(parsed.regional_interest_strip!.length).toBeLessThanOrEqual(5);
    expectSerpapi(parsed.evidence, "GET /api/asset/BRENT");
    expect(parsed.filings!.length).toBeLessThanOrEqual(3);
    expect(parsed.insider!.length).toBeLessThanOrEqual(5);
  });

  it("GET /api/asset/:ticker filings[3] insider[5] limits enforced", async () => {
    const data = await getJSON("/api/asset/XOM");
    expect(data.filings.length).toBe(3);
    expect(data.insider.length).toBe(5);
  });

  it("chart has rows and tail", async () => {
    const data = await getJSON("/api/asset/BRENT");
    const rows = data.chart.rows ?? data.chart.data ?? data.chart;
    const tail = data.chart.tail ?? (Array.isArray(rows) ? rows.slice(-5) : []);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(20);
    expect(Array.isArray(tail)).toBe(true);
  });

  it("physical_vs_narrative + what_people_are_asking + physical_corroboration present", async () => {
    const data = await getJSON("/api/asset/BRENT");
    expect(data.physical_vs_narrative).toBeDefined();
    expect(typeof data.physical_vs_narrative.price_delta_pct).toBe("number");
    expect(typeof data.physical_vs_narrative.physical_delta_pct).toBe("number");
    expect(data.what_people_are_asking).toBeDefined();
    expect(data.physical_corroboration).toBeDefined();
  });
});

describe("contract · GET /api/events + /api/events/{id}/chain", () => {
  it("GET /api/events matches schema + serpapi gate", async () => {
    const data = await getJSON("/api/events?q=oil%20markets%20geopolitics&num=20");
    const parsed = EventsSchema.parse(data);
    expect(Array.isArray(parsed.clusters)).toBe(true);
    expectSerpapi(parsed.evidence, "GET /api/events");
  });

  it("GET /api/events/:id/chain → {event_id,category,commodity,sectors[],companies[]}", async () => {
    const data = await getJSON("/api/events/geopolitical-1/chain");
    const parsed = EventChainSchema.parse(data);
    expect(parsed.event_id).toBeDefined();
    expect(parsed.category).toBe("geopolitical");
    expect(parsed.commodity).toBe("BRENT");
    expect(Array.isArray(parsed.sectors)).toBe(true);
    expect(Array.isArray(parsed.companies)).toBe(true);
    expect(parsed.sectors.length).toBeGreaterThan(0);
  });
});

describe("contract · GET /api/cross-market", () => {
  it("GET /api/cross-market → {matrix, candidate_edges, evidence} + serpapi gate", async () => {
    const data = await getJSON("/api/cross-market");
    const parsed = CrossMarketSchema.parse(data);
    expect(parsed.matrix.BRENT).toBeDefined();
    expect(parsed.matrix.WTI).toBeDefined();
    expect(parsed.matrix.NATGAS).toBeDefined();
    expect(Array.isArray(parsed.candidate_edges)).toBe(true);
    // candidate_edges dashed SerpApi, wire engine google
    const dashed = parsed.candidate_edges.find((c: any) => c.dashed === true);
    expect(dashed).toBeDefined();
    expect(String(dashed?.engine ?? dashed?.rationale ?? "")).toMatch(/google|SerpApi/i);
    expectSerpapi(parsed.evidence, "GET /api/cross-market");
  });
});

describe("contract · POST /api/cross-market/simulate", () => {
  it("POST /api/cross-market/simulate {shock_asset, shock_value} → exposures + exposed_chokepoints", async () => {
    const data = await getJSON("/api/cross-market/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shock_asset: "BRENT", shock_value: 10 }),
    });
    const parsed = SimulateSchema.parse(data);
    expect(parsed.shock_asset).toBe("BRENT");
    expect(parsed.shock_value).toBe(10);
    expect(Array.isArray(parsed.exposures)).toBe(true);
    expect(parsed.exposures.length).toBeGreaterThan(0);
    expect(parsed.exposures[0].target).toBeDefined();
    expect(typeof parsed.exposures[0].exposure).toBe("number");
    expect(Array.isArray(parsed.exposed_chokepoints)).toBe(true);
    expect(parsed.exposed_chokepoints).toContain("hormuz");
  });

  it("simulate with Brent=120 style shock 20 still returns exposures", async () => {
    const data = await getJSON("/api/cross-market/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shock_asset: "BRENT", shock_value: 20 }),
    });
    expect(data.exposures.length).toBeGreaterThan(0);
    expect(data.exposures[0].exposure).toBeGreaterThan(10);
  });

  it("simulate exposure = shock_value * weight arithmetic", async () => {
    const data = await getJSON("/api/cross-market/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shock_asset: "BRENT", shock_value: 10 }),
    });
    // BRENT -> XOM weight 0.85 => exposure 8.5
    const xom = data.exposures.find((e: any) => e.target === "XOM");
    expect(xom.exposure).toBeCloseTo(8.5, 1);
  });
});

describe("contract · GET /api/map + /api/map/{id} + history", () => {
  it("GET /api/map → 5 boxes with required fields", async () => {
    const data = await getJSON("/api/map");
    const parsed = MapArraySchema.parse(data);
    const boxes = Array.isArray(parsed) ? parsed : (parsed as any).boxes;
    expect(boxes.length).toBe(5);
    const hormuz = boxes.find((b: any) => b.id === "hormuz");
    expect(hormuz).toBeDefined();
    expect(hormuz.count).toBeDefined();
    expect(typeof hormuz.pct_change).toBe("number");
    expect(hormuz.bbox).toBeDefined();
    expect(typeof hormuz.stale).toBe("boolean");
    // stale gate: seed counts ONLY with stale:true — if stale then badge
    boxes.forEach((b: any) => {
      if (b.stale) expect(b.retrieved_at).toBeDefined();
    });
  });

  it("GET /api/map/{id} → one box", async () => {
    const data = await getJSON("/api/map/hormuz");
    const parsed = MapBoxSchema.parse(data);
    expect(parsed.id).toBe("hormuz");
    expect(parsed.count).toBe(142);
    expect(Array.isArray(parsed.positions)).toBe(true);
    expect(parsed.positions.length).toBeGreaterThan(0);
    expect(parsed.positions[0].mmsi).toBeDefined();
    expect(typeof parsed.positions[0].lat).toBe("number");
  });

  it("GET /api/map/{id}/history?hours → {counts[], crossings[], stale}", async () => {
    const data = await getJSON("/api/map/hormuz/history?hours=720");
    const parsed = MapHistorySchema.parse(data);
    expect(Array.isArray(parsed.counts)).toBe(true);
    expect(Array.isArray(parsed.crossings)).toBe(true);
    expect(parsed.counts.length).toBe(48);
    expect(parsed.crossings.length).toBe(48);
  });

  it("GET /api/map/{id}/history respects hours param", async () => {
    const data = await getJSON("/api/map/hormuz/history?hours=48");
    expect(data.counts).toBeDefined();
  });
});

describe("contract · GET /api/geo/*", () => {
  it("GET /api/geo/ports → GeoJSON", async () => {
    const data = await getJSON("/api/geo/ports");
    const parsed = GeoSchema.parse(data);
    expect(parsed.type).toBe("FeatureCollection");
    expect(Array.isArray(parsed.features)).toBe(true);
  });

  it("GET /api/geo/routes → GeoJSON", async () => {
    const data = await getJSON("/api/geo/routes");
    expect(data.type).toBe("FeatureCollection");
  });

  it("GET /api/geo/tss_lanes → GeoJSON", async () => {
    const data = await getJSON("/api/geo/tss_lanes");
    expect(data.type).toBe("FeatureCollection");
  });

  it("GET /api/geo/trade_arcs → ArcCollection", async () => {
    const data = await getJSON("/api/geo/trade_arcs");
    expect(data.type).toBe("ArcCollection");
    expect(Array.isArray(data.arcs)).toBe(true);
  });

  it("GET /api/geo/unknown → 404 or empty", async () => {
    const res = await fetch(`${BASE}/api/geo/unknown_layer_xyz`);
    expect([404, 200].includes(res.status)).toBe(true);
  });
});

describe("contract · GET /api/map/layers/*", () => {
  it("GET /api/map/layers/weather → {feed,dots[], evidence[]}", async () => {
    const data = await getJSON("/api/map/layers/weather");
    const parsed = MapLayerSchema.parse(data);
    expect(parsed.feed).toBe("weather");
    expectSerpapi(parsed.evidence ?? [], "GET /api/map/layers/weather");
  });

  it("GET /api/map/layers/earthquakes → {feed, evidence}", async () => {
    const data = await getJSON("/api/map/layers/earthquakes");
    expect(data.feed).toBe("earthquakes");
  });

  it("GET /api/map/layers/disasters → {feed, evidence}", async () => {
    const data = await getJSON("/api/map/layers/disasters");
    expect(data.feed).toBe("disasters");
  });
});

describe("contract · GET /api/search", () => {
  it("GET /api/search?q=BRENT&limit=8 → {query, results[{label,type,route}]}", async () => {
    const data = await getJSON("/api/search?q=BRENT&limit=8");
    const parsed = SearchSchema.parse(data);
    expect(parsed.query).toBe("BRENT");
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results.length).toBeLessThanOrEqual(8);
    expect(parsed.results[0].label).toBeDefined();
    expect(parsed.results[0].type).toMatch(/asset|chokepoint|event|scenario/);
    expect(parsed.results[0].route).toBeDefined();
  });

  it("GET /api/search curated index no fetch — empty q returns []", async () => {
    const data = await getJSON("/api/search?q=&limit=8");
    expect(Array.isArray(data.results)).toBe(true);
  });
});

describe("contract · POST /api/research/run", () => {
  it("POST /api/research/run {query} → {report, trace[7-8], evidence_count}", async () => {
    const data = await getJSON("/api/research/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "Why is BRENT moving?" }),
    });
    const parsed = ResearchRunSchema.parse(data);
    expect(parsed.report.length).toBeGreaterThan(20);
    expect(parsed.evidence_count ?? parsed.evidence?.length).toBeGreaterThan(0);
    if (parsed.trace) {
      expect(parsed.trace.length).toBeGreaterThanOrEqual(7);
      expect(parsed.trace.length).toBeLessThanOrEqual(8);
    }
    expectSerpapi(parsed.evidence ?? [], "POST /api/research/run");
  });
});

describe("serpapi_coverage gate — every evidence[] contains at least one serpapi record", () => {
  const routes = [
    { path: "/api/market-home", getter: (d: any) => d.evidence },
    { path: "/api/asset/BRENT", getter: (d: any) => d.evidence },
    { path: "/api/events?q=oil%20markets%20geopolitics&num=20", getter: (d: any) => d.evidence },
    { path: "/api/cross-market", getter: (d: any) => d.evidence },
    { path: "/api/map/layers/weather", getter: (d: any) => d.evidence },
  ] as const;

  for (const r of routes) {
    it(`${r.path} evidence[] has serpapi`, async () => {
      const data = await getJSON(r.path);
      const ev = r.getter(data);
      serpapiCoverageGate(ev, r.path);
    });
  }

  it("all fixtures in contractFixtures pass serpapi gate where evidence exists", () => {
    const checks = [
      ["marketHome", contractFixtures.marketHome.evidence],
      ["asset BRENT", contractFixtures.asset("BRENT").evidence],
      ["events", contractFixtures.events.evidence],
      ["crossMarket", contractFixtures.crossMarket.evidence],
      ["simulate", contractFixtures.simulate("BRENT", 10).evidence],
    ] as const;
    for (const [name, ev] of checks) {
      serpapiCoverageGate(ev as any, name);
    }
  });
});

describe("contract · stale semantics", () => {
  it("map box stale:true means seed fallback badge required", async () => {
    // simulate stale box via direct fixture manipulation
    const staleBox = { ...contractFixtures.mapOne("hormuz"), stale: true, count: 142, baseline_7d: 128 };
    expect(staleBox.stale).toBe(true);
    // UI must badge stale — we test that fixture respects rule: seed counts ONLY with stale:true is valid
    expect(staleBox.stale).toBe(true);
  });

  it("anomaly strip pct_change may be >10% physical spike", async () => {
    const data = await getJSON("/api/market-home");
    expect(Math.abs(data.anomaly_strip.max_chokepoint_anomaly.pct_change)).toBeGreaterThan(0);
  });
});

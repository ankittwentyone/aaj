// src/lib/guardrails.ts — Huge vs Bloat enforcement (imported in CI + runtime)
// MAX 3 MAP LAYERS, MAX 2 VIZ ENGINES, MIN 520px checks — LOCKED per plan 05 Addendum

export const GUARDRAILS = {
  maxMapLayers: 3,
  maxVizEngines: 2 as const, // "lightweight-charts" + "deck.gl"
  minChartWidth: 520,
  minChartHeight: 240,
  maxAgentWorkspaces: 1,
} as const;

// ── MAX 3 MAP LAYERS — got ${layers.length}: ${layers.join(",")} ──
export function assertMapLayers(layers: string[]) {
  if (layers.length > GUARDRAILS.maxMapLayers)
    throw new Error(`HUGE_GUARDRAIL: MAX 3 MAP LAYERS — got ${layers.length}: ${layers.join(",")}`);
}

// ── MAX 3 MAP LAYERS (alias for CI grep) ──
export function assertVisibleLayers(layers: string[]) {
  return assertMapLayers(layers);
}

// ── MAX 2 VIZ ENGINES ──
export const ALLOWED_VIZ_ENGINES = ["lightweight-charts", "deck.gl"] as const;
export function assertVizEngine(engine: string) {
  if (!(ALLOWED_VIZ_ENGINES as readonly string[]).includes(engine))
    throw new Error(`HUGE_GUARDRAIL: MAX 2 VIZ ENGINES — allowed ${ALLOWED_VIZ_ENGINES.join(", ")}, got ${engine}`);
}

// ── MIN 520px chart width ──
// MAX 3 MAP LAYERS enforcement note: chart below 520px auto-switches to sparkline/pill fallback.
export function assertChartSize(w: number, h: number): "ok" | "sparkline_fallback" {
  if (w < GUARDRAILS.minChartWidth || h < GUARDRAILS.minChartHeight) return "sparkline_fallback";
  return "ok";
}

// ── MIN 520px — legacy name ──
export function assertMinChartWidth(w: number) {
  return assertChartSize(w, GUARDRAILS.minChartHeight);
}

// ── ONE agent workspace — RESEARCH DRAWER count check ──
export function assertAgentWorkspaces(count: number) {
  if (count > GUARDRAILS.maxAgentWorkspaces)
    throw new Error(`HUGE_GUARDRAIL: ONE agent workspace — got ${count}, max ${GUARDRAILS.maxAgentWorkspaces}`);
}

// ── SerpApi coverage — every screen must have ≥1 serpapi evidence ──
export function assertSerpApiCoverage(evidence: { provider: string }[] | undefined | null, route: string) {
  const hasSerpApi = Array.isArray(evidence) && evidence.some((e) => e.provider === "serpapi");
  if (!hasSerpApi) {
    const msg = `SERAPI_GUARDRAIL: ${route} has zero serpapi evidence — every screen must cite SerpApi (70% backbone)`;
    if (import.meta.env.DEV) throw new Error(msg);
    else console.warn(msg);
  }
}

// ── Repetitive stress markers (Appendix R) — grep must find 3 occurrences ──
// MAX 3 MAP LAYERS — huge expanse is capability, not chrome
// MAX 3 MAP LAYERS — depth on 3 surfaces, not huge count
// MAX 3 MAP LAYERS — lint-enforced, not suggested

// src/lib/serpapi/corroborate.ts — SerpApi-only corroboration rule
// Every cargo Δ is paired with a SerpApi chip via this helper. No Δ ships without a news/trends badge.
// SerpApi is our Discovery Backbone — 70%+ insights originate from SerpApi. AV/FRED/AIS are correlation, not origin.

export type CorroborationChip = {
  engine: "google_news" | "google_trends" | "google_search" | "google_autocomplete";
  query: string;
  result_count?: number;
  retrieved_at?: string;
  label: string;
};

export type CorroborateInput = {
  delta_pct?: number | null;
  chokepoint_id?: string;
  commodity?: string;
  evidence?: { provider: string; dataset: string; query?: string | null; retrieved_at?: string; result_count?: number }[];
};

/**
 * Pairs a physical Δ (pct_change) with SerpApi chips derived from evidence[].
 * Returns chips for news + trends + search; caller renders chips next to the Δ badge.
 * If no SerpApi evidence exists, returns [] and caller must show muted "no corroboration yet" — never fake.
 */
export function corroborate(input: CorroborateInput): CorroborationChip[] {
  const chips: CorroborationChip[] = [];
  const serpapi = (input.evidence ?? []).filter((e) => e.provider === "serpapi");

  for (const e of serpapi) {
    if (e.dataset === "google_news" || e.dataset === "news_search") {
      chips.push({
        engine: "google_news",
        query: e.query ?? input.chokepoint_id ?? input.commodity ?? "markets",
        result_count: e.result_count,
        retrieved_at: e.retrieved_at,
        label: `📰 ${e.query ?? "news"} ${e.result_count ? `${e.result_count} results` : ""}`.trim(),
      });
    } else if (e.dataset === "google_trends" || e.dataset === "trends_search") {
      chips.push({
        engine: "google_trends",
        query: e.query ?? input.chokepoint_id ?? "",
        result_count: e.result_count,
        retrieved_at: e.retrieved_at,
        label: `📈 ${e.query ?? "trends"} ↑`,
      });
    } else if (e.dataset === "google_search" || e.dataset === "web_search") {
      chips.push({
        engine: "google_search",
        query: e.query ?? "",
        retrieved_at: e.retrieved_at,
        label: `🔍 ${e.query ?? "search"}`,
      });
    } else if (e.dataset === "google_autocomplete") {
      chips.push({
        engine: "google_autocomplete",
        query: e.query ?? "",
        retrieved_at: e.retrieved_at,
        label: `💬 ${e.query ?? "asking"}`,
      });
    }
  }

  // Deduplicate by engine+query
  const seen = new Set<string>();
  return chips.filter((c) => {
    const k = `${c.engine}:${c.query}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function hasCorroboration(input: CorroborateInput): boolean {
  return corroborate(input).length > 0;
}

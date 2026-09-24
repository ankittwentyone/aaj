import { normalizeProvider } from "@/lib/serpapi/originBadge";

export type EvidenceRow = {
  provider: string;
  dataset?: string;
  engine?: string;
  query?: string;
  source_url?: string;
  retrieved_at?: string;
  result_count?: number;
};

/** Infer provider when backend rows only set dataset/engine (avoids "undefined" in UI). */
export function inferEvidenceProvider(raw: Record<string, unknown>): string {
  const explicit = raw.provider;
  if (explicit != null && String(explicit).trim()) return normalizeProvider(String(explicit));

  const ds = String(raw.dataset ?? raw.engine ?? "").toLowerCase();
  if (ds.includes("google") || ds.includes("serpapi") || ds.startsWith("google_")) return "serpapi";
  if (ds.includes("fred") || ds === "dgs10") return "fred";
  if (ds.includes("eia")) return "eia";
  if (ds.includes("sec") || ds.includes("edgar")) return "sec";
  if (ds.includes("alphavantage") || ds === "av" || ds.includes("global quote")) return "alphavantage";
  if (ds.includes("yfinance") || ds.includes("yahoo")) return "yfinance";
  if (ds.includes("ais")) return "aisstream";

  const url = String(raw.source_url ?? "").toLowerCase();
  if (url.includes("google.")) return "serpapi";
  if (url.includes("sec.gov")) return "sec";
  if (url.includes("fred.stlouisfed")) return "fred";
  if (url.includes("eia.gov")) return "eia";

  return "correlation";
}

export function normalizeEvidenceList(list: unknown[]): EvidenceRow[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) => {
    const e = (item ?? {}) as Record<string, unknown>;
    const provider = inferEvidenceProvider(e);
    return {
      provider,
      dataset: (e.dataset ?? e.engine) as string | undefined,
      engine: e.engine as string | undefined,
      query: e.query as string | undefined,
      source_url: e.source_url as string | undefined,
      retrieved_at: e.retrieved_at as string | undefined,
      result_count: e.result_count as number | undefined,
    };
  });
}

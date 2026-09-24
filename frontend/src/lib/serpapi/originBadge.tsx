// src/lib/serpapi/originBadge.tsx — SerpApi Primacy Honest Frame (plan 10)
// "SerpApi is our Discovery Backbone. 70%+ insights originate from SerpApi. AV/FRED/AIS are correlation, not origin."
// Every card/report shows Origin: SerpApi vs Correlation: AV/FRED per plan 10.
// via SerpApi vs via SEC distinction — amber vs zinc — 70%+ pills amber at glance proves primacy.

import { cn } from "@/lib/utils";

export type OriginKind = "serpapi" | "correlation" | "ground" | "sec";

export function normalizeProvider(provider?: string | null): string {
  const p = (provider ?? "unknown").trim().toLowerCase();
  return p || "unknown";
}

export function getOriginKind(provider?: string | null): OriginKind {
  const p = normalizeProvider(provider);
  if (p === "serpapi") return "serpapi";
  if (p === "sec" || p === "edgar") return "sec";
  if (p === "aisstream" || p === "ais") return "ground";
  return "correlation";
}

export function getOriginLabel(provider?: string | null, dataset?: string): string {
  const kind = getOriginKind(provider);
  const p = normalizeProvider(provider);
  if (kind === "serpapi") return "Origin: SerpApi";
  if (kind === "sec") return "via SEC direct";
  if (kind === "ground") return "Ground: AIS";
  if (p === "fred" || dataset === "fred" || dataset === "DGS10") return "Correlation: FRED";
  if (p === "alphavantage" || p === "av") return "Correlation: AV";
  if (p === "eia") return "Correlation: EIA";
  return "Correlation: AV/FRED";
}

export function getOriginStyle(provider?: string | null, dataset?: string, engine?: string): string {
  const p = normalizeProvider(provider);
  // via SerpApi distinct amber/blue/emerald/violet — via SEC/FRED distinct zinc
  if (p === "serpapi") {
    if (engine === "google_news" || dataset === "google_news" || dataset === "news_search") return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    if (engine === "google_trends" || dataset === "google_trends" || dataset === "trends_search") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (engine === "google_search" || dataset === "google_search" || dataset === "web_search") return "text-violet-400 bg-violet-500/10 border-violet-500/30";
    if (engine === "google_autocomplete" || dataset === "google_autocomplete") return "text-amber-400 bg-amber-500/10 border-amber-600";
    return "text-amber-400 bg-amber-500/10 border-amber-600";
  }
  if (p === "sec" || p === "edgar") return "text-zinc-300 bg-zinc-800 border-zinc-700";
  if (p === "aisstream" || p === "ais") return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30";
  if (p === "fred") return "text-zinc-400 bg-zinc-900 border-zinc-800";
  if (p === "alphavantage" || p === "av") return "text-slate-400 bg-slate-800 border-slate-700";
  if (p === "eia") return "text-slate-400 bg-slate-800/80 border-slate-700";
  return "text-slate-400 bg-slate-800 border-slate-700";
}

// Citation pill style — via SerpApi vs via SEC vs via FRED — 70%+ amber at glance
export function getCiteStyle(rec: { provider?: string | null; dataset?: string; engine?: string }): string {
  const p = normalizeProvider(rec.provider);
  if (p === "serpapi") return "text-amber-400 bg-amber-500/10 border-amber-600";
  if (p === "sec" || p === "edgar") return "text-zinc-300 bg-zinc-800 border-zinc-700";
  // via FRED / via AIS — correlation distinct zinc-400
  return "text-zinc-400 bg-zinc-900 border-zinc-800";
}

export function OriginBadge({ provider, dataset, engine, query }: { provider?: string | null; dataset?: string; engine?: string; query?: string }) {
  const p = normalizeProvider(provider);
  const label = getOriginLabel(p, dataset);
  const style = getOriginStyle(p, dataset, engine);
  const via =
    p === "serpapi"
      ? `via SerpApi · ${engine ?? dataset ?? "serpapi"}`
      : p === "sec"
        ? `via SEC direct · EDGAR`
        : `via ${p.toUpperCase()}${dataset ? ` · ${dataset}` : ""}`;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-mono font-semibold tracking-[0.06em] uppercase", style)} title={query ?? via}>
      {label}
      {(engine || dataset) && <span className="opacity-70 font-normal normal-case tracking-normal">· {engine ?? dataset}</span>}
    </span>
  );
}

// EngineBadge — mono 10px per-engine color for trace rows
export function EngineBadge({ engine }: { engine?: string }) {
  if (!engine) return null;
  const map: Record<string, string> = {
    google_news: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    google_trends: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    google_search: "text-violet-400 bg-violet-500/10 border-violet-500/30",
    google_autocomplete: "text-amber-400 bg-amber-500/10 border-amber-600",
    alphavantage: "text-slate-400 bg-slate-800 border-slate-700",
    fred: "text-zinc-400 bg-zinc-900 border-zinc-800",
    aisstream: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    sec: "text-teal-400 bg-teal-500/10 border-teal-500/30",
  };
  const style = map[engine] ?? "text-ink-muted bg-panel border-border-subtle";
  return <span className={cn("inline-flex items-center rounded-pill border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em]", style)}>{engine}</span>;
}

// FaviconImg — s2 favicon helper for evidence triad (engine+query+favicon)
export function FaviconImg({ domain, size = 16 }: { domain?: string; size?: number }) {
  if (!domain) return <span className="h-4 w-4 rounded bg-zinc-800 border border-zinc-700 shrink-0" />;
  const host = domain.replace(/^https?:\/\//, "").split("/")[0];
  return <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`} alt="" width={size} height={size} className="rounded shrink-0" loading="lazy" />;
}

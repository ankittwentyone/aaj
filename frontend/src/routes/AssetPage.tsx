import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchAsset } from "@/api/client";
import { TTL_S } from "@/lib/ttls";
import { ChartPanel } from "@/components/Asset/ChartPanel";
import { VerdictPanel } from "@/components/Asset/VerdictPanel";
import { FilingsList } from "@/components/Asset/FilingsList";
import { useEffect, useState } from "react";
import { subscribeHighlight, getHighlight } from "@/lib/linkedHighlight";
import { FaviconImg } from "@/lib/serpapi/originBadge";
import { StaleBadge } from "@/components/ui/Badge";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { normalizeQuoteFromRecord } from "@/lib/normalizeQuote";
import { normalizeAskingList } from "@/lib/normalizeTrends";
import { ChangeCell } from "@/components/ui/ChangeCell";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { EvidenceChip } from "@/components/EvidenceChip";
import { useInstrument } from "@/context/InstrumentContext";

function unwrapPayload(rec: any): any {
  if (!rec) return null;
  if (Array.isArray(rec)) return rec;
  if (rec?.payload) return rec.payload;
  return rec;
}

export default function AssetPage() {
  const { ticker = "BRENT" } = useParams();
  const { setTicker } = useInstrument();
  useEffect(() => {
    if (ticker) setTicker(ticker);
  }, [ticker, setTicker]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["asset", ticker],
    queryFn: () => fetchAsset(ticker),
    staleTime: Infinity,
    gcTime: TTL_S["asset:quote"] * 1000,
  });

  const [hl, setHl] = useState(getHighlight());
  useEffect(() => subscribeHighlight(() => setHl(getHighlight())), []);

  if (isLoading) return <div className="terminal-page p-8 text-ink-muted">Loading {ticker}…</div>;
  if (error) return <div className="terminal-page p-8 text-danger">Failed to load {ticker}</div>;

  const quote = normalizeQuoteFromRecord(ticker, data?.quote);
  const changePctRaw = quote.changePct;

  const rising: any[] = data?.rising_queries_badge ?? unwrapPayload(data?.trends)?.rising_queries ?? unwrapPayload(data?.trends)?.related_queries?.rising ?? data?.trends?.rising_queries ?? [];
  const regional: any[] = data?.regional_interest_strip ?? unwrapPayload(data?.trends)?.geo ?? unwrapPayload(data?.trends)?.interest_by_region ?? data?.trends?.regional_interest ?? [];
  const askingList = normalizeAskingList(data?.what_people_are_asking, data?.trends);

  const physRaw: any = unwrapPayload(data?.physical_corroboration) ?? data?.physical_corroboration;
  const phys = physRaw?.payload ?? physRaw ?? null;
  const physPayload = phys ?? {};
  const physCount = physPayload?.count ?? physPayload?.vessels ?? physPayload?.value ?? null;
  const physPct = data?.physical_vs_narrative?.physical_delta_pct ?? physPayload?.pct_change ?? null;
  const physId =
    data?.physical_corroboration?.entity_id ??
    physPayload?.id ??
    physPayload?.chokepointId ??
    physPayload?.chokepoint ??
    null;
  const physStale = data?.physical_corroboration?.stale === true || physPayload?.stale === true || data?.physical_corroboration?.status === "skipped";

  const fundRaw: any = unwrapPayload(data?.fundamentals);
  const fund = fundRaw?.["payload"] ? fundRaw.payload : fundRaw;
  const fundPayload: any = fund && typeof fund === "object" && !Array.isArray(fund) ? fund : null;
  const isFundSkipped = data?.fundamentals?.status === "skipped" || fundPayload == null || Object.keys(fundPayload ?? {}).length === 0 || fundPayload?.Information != null;

  const newsRaw: any = data?.news_timeline;
  const newsList: any[] = (() => {
    if (Array.isArray(newsRaw)) return newsRaw;
    const p = unwrapPayload(newsRaw);
    if (Array.isArray(p)) return p;
    if (p?.news_results && Array.isArray(p.news_results)) return p.news_results;
    if (p?.clusters && Array.isArray(p.clusters)) return p.clusters;
    return [];
  })();

  return (
    <div className="terminal-page space-y-4 overflow-x-hidden">
      <Breadcrumb section="Asset" ticker={ticker} />
      <div className="flex flex-wrap items-center gap-3">
        <AssetIcon ticker={ticker} size={32} />
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{ticker}</h1>
        <span className="font-mono text-lg tabular-nums border border-border-subtle rounded-full px-3 py-1 bg-panel">{quote.displayPrice}</span>
        <ChangeCell changePct={changePctRaw} size="lg" />
        {quote.stale && <StaleBadge retrieved_at={data?.quote?.retrieved_at} stale status={data?.quote?.status} dataset="asset:quote" />}
        {hl?.commodity && <span className="text-xs font-mono bg-white text-zinc-950 rounded-full px-2 py-0.5">linked · {hl.commodity}</span>}
        <div className="ml-auto flex gap-3 text-xs">
          <Link
            to={`/research?research=${encodeURIComponent(`Why is ${ticker} moving today?`)}`}
            className="text-voltage font-semibold hover:underline"
          >
            Investigate →
          </Link>
          <Link to="/map" className="text-ink-muted hover:text-ink">Map</Link>
        </div>
      </div>

      <ChartPanel rawChart={data?.chart} evidence={data?.chart} />

      <VerdictPanel data={data} />

      {/* G-020 + G-039 Trends badges — rising_queries_badge / regional_interest_strip / autocomplete asking panel + physical_corroboration strip */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 terminal-panel p-4 space-y-4 overflow-hidden">
          {/* Rising queries badge */}
          <div>
            <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400 flex items-center gap-2 flex-wrap">
              Rising Queries · SerpApi Trends
              {data?.trends?.provider && (
                <EvidenceChip provider={data.trends.provider} dataset={data.trends.dataset} query={data.trends.query} retrieved_at={data.trends.retrieved_at} stale={data.trends.stale} />
              )}
              {rising.length > 0 && <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-600 px-2 py-0.5 text-[10px] font-mono text-amber-400">{rising.length} badges</span>}
            </div>
            {rising.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {rising.slice(0, 5).map((q: any, i: number) => {
                  const label = typeof q === "string" ? q : q.query ?? q.title ?? q.keyword ?? JSON.stringify(q).slice(0, 30);
                  const isHl = hl?.commodity && String(label).toLowerCase().includes(String(hl.commodity).toLowerCase());
                  return (
                    <span key={i} className={`h-6 px-3 rounded-full border text-[11px] font-mono flex items-center gap-1.5 ${isHl ? "bg-white text-zinc-950 border-white" : "bg-amber-500/10 border-amber-600 text-amber-400"}`} title={String(label)}>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" /> {String(label)}
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-ink-muted mt-2">Trend data unavailable — add SerpApi key or retry.</div>
            )}
          </div>

          {/* Regional interest strip */}
          <div>
            <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400">Regional Interest Strip</div>
            {regional.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {regional.slice(0, 5).map((r: any, i: number) => {
                  const label = r.geo ?? r.region ?? r.name ?? r.geoName ?? r.location ?? "";
                  const val = r.value ?? r.interest ?? r.formattedValue ?? r.extracted_value ?? 0;
                  const num = typeof val === "string" ? Number(val.replace(/[^0-9.-]/g, "")) : Number(val);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-24 text-[11px] font-mono text-zinc-500 truncate" title={String(label)}>{String(label) || `region-${i}`}</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-sky-500" style={{ width: `${Math.min(100, isNaN(num) ? 0 : num)}%` }} /></div>
                      <span className="text-[11px] font-mono text-zinc-400 w-8 text-right">{isNaN(num) ? String(val).slice(0, 8) : num}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-ink-muted mt-2">Regional interest not available.</div>
            )}
          </div>

          {/* Autocomplete asking panel — G-020 asking */}
          <div>
            <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400">What people are asking — Autocomplete</div>
            {askingList.length > 0 ? (
              <div className="mt-2 rounded-lg border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
                <div className="h-9 px-3 flex items-center gap-2 bg-canvas text-xs text-ink-muted font-mono">
                  <span className="h-2 w-2 rounded-full bg-zinc-700" /> why is {ticker.toLowerCase()}…
                </div>
                {askingList.slice(0, 6).map((q, i) => (
                  <Link
                    key={i}
                    to={`/research?research=${encodeURIComponent(q)}`}
                    className="h-9 px-3 flex items-center gap-2 text-sm hover:bg-zinc-900 transition-colors"
                  >
                    <span className="text-ink-dim">⌕</span><span className="truncate">{q}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-xs text-ink-muted mt-2">No autocomplete suggestions yet.</div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 space-y-4">
          {/* Physical corroboration */}
          <div className="terminal-panel p-4">
            <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400 flex items-center gap-2">Physical Corroboration · AIS {physStale && <span className="inline-flex items-center rounded-full bg-warning-dim border border-warning-border px-2 py-0.5 text-[10px] font-mono text-warning">Stale · seed</span>}</div>
            {phys ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-baseline gap-2"><span className="text-sm font-medium">{physId ?? physPayload?.name ?? "Most anomalous chokepoint"}</span><span className="text-xs font-mono text-zinc-500">{physPayload?.name ?? ""}</span></div>
                <div className="flex items-center gap-3 text-sm font-mono tabular-nums"><span>{physCount ?? "—"} vessels</span><span className={Number(physPct) > 0 ? "text-success" : Number(physPct) < 0 ? "text-danger" : "text-zinc-500"}>{physPct != null ? `${Number(physPct) > 0 ? "+" : ""}${physPct}%` : "—"}</span></div>
                {physPayload?.retrieved_at && <div className="text-[11px] font-mono text-zinc-600">{String(physPayload.retrieved_at)}</div>}
                {physId && (
                  <a href={`/map?choke=${encodeURIComponent(String(physId))}`} className="text-xs text-voltage hover:underline">
                    View on map →
                  </a>
                )}
              </div>
            ) : (
              <div className="text-sm text-zinc-500 mt-2">No physical corroboration — AIS empty</div>
            )}
          </div>

          {/* Fundamentals */}
          <div className="terminal-panel p-4 overflow-hidden">
            <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400">Fundamentals · AV OVERVIEW</div>
            {isFundSkipped ? (
              <div className="text-sm text-zinc-500 mt-2">Not applicable — SEC live for equities only · {data?.fundamentals?.status === "skipped" ? `skipped: ${data.fundamentals.reason ?? ""}`.slice(0, 80) : "commodity/FX has no AV OVERVIEW"}</div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ["Symbol", fundPayload?.Symbol],
                  ["Name", fundPayload?.Name],
                  ["Sector", fundPayload?.Sector],
                  ["Industry", fundPayload?.Industry],
                  ["PERatio", fundPayload?.PERatio],
                  ["MarketCap", fundPayload?.MarketCapitalization],
                  ["DividendYield", fundPayload?.DividendYield],
                  ["52WeekHigh", fundPayload?.["52WeekHigh"]],
                  ["52WeekLow", fundPayload?.["52WeekLow"]],
                  ["EPS", fundPayload?.EPS],
                  ["Beta", fundPayload?.Beta],
                ].filter(([, v]) => v != null && String(v).length > 0).slice(0, 10).map(([k, v]) => (
                  <div key={k} className="flex flex-col"><span className="text-[10px] font-mono uppercase tracking-[0.06em] text-zinc-500">{k}</span><span className="truncate font-mono text-xs text-zinc-300">{String(v)}</span></div>
                ))}
                {fundPayload && Object.keys(fundPayload).length === 0 && <div className="col-span-2 text-xs text-zinc-600">Empty fundamentals payload</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* News timeline h56 per cluster */}
      <div className="terminal-panel p-4 overflow-hidden">
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400">News timeline · {newsList.length}</div>
        {newsList.length > 0 ? (
          <div className="mt-3 divide-y divide-zinc-800 border border-zinc-800 rounded-lg overflow-hidden">
            {newsList.slice(0, 6).map((n: any, i: number) => {
              const p = n?.payload ?? n;
              const title = p?.title ?? p?.payload?.title ?? n?.title ?? String(n).slice(0, 80);
              const link = p?.link ?? p?.source_url ?? n?.source_url ?? p?.url ?? "";
              const src = p?.source?.name ?? p?.source ?? p?.publisher ?? "";
              const date = p?.date ?? p?.published_at ?? n?.retrieved_at ?? "";
              return (
                <a key={i} href={link || "#"} target={link ? "_blank" : undefined} rel="noreferrer" className="h-14 flex items-center gap-3 px-3 hover:bg-zinc-900 transition-colors text-left" style={{ height: 56 }}>
                  <FaviconImg domain={link || "https://news.google.com"} size={16} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate leading-tight">{String(title)}</span>
                    <span className="block text-[11px] font-mono text-zinc-500 truncate">{src ? `${src} · ` : ""}{date ? String(date).slice(0, 16) : ""}{link ? ` · ${(() => { try { return new URL(link).hostname; } catch { return link.slice(0, 24); }})()}` : ""}</span>
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-zinc-500 mt-3">No news timeline — SerpApi google_news empty (live data unavailable)</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 max-[720px]:grid-cols-1">
        <div className="terminal-panel p-4 overflow-hidden">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-400">Filings & Insider · SEC EDGAR</div>
          <div className="mt-3"><FilingsList filings={data?.filings} insider={data?.insider} /></div>
        </div>
        <div className="terminal-panel p-4 overflow-hidden">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-400">Evidence · SerpApi vs correlation</div>
          <div className="mt-2 text-xs font-mono text-zinc-500">evidence {data?.evidence?.length ?? 0} · via SerpApi {data?.evidence?.filter((e:any)=>e.provider==="serpapi").length ?? 0} · via AV/FRED {(data?.evidence?.length ?? 0) - (data?.evidence?.filter((e:any)=>e.provider==="serpapi").length ?? 0)}</div>
          <div className="mt-2 space-y-1">
            {(data?.evidence ?? []).slice(0, 6).map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs"><FaviconImg domain={e.source_url ?? (e.provider==="serpapi" ? "https://google.com" : e.provider==="sec" ? "https://sec.gov" : undefined)} size={14} /><span className="font-mono text-zinc-400 truncate">{e.provider} · {e.dataset} {e.query ? `· "${e.query}"` : ""}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { fetchMapHistory } from "@/api/client";
import { TTL_S } from "@/lib/ttls";
import { CrossingsChart, SogHistogram, normalizeSeries } from "./CrossingsChart";
import { Sparkline } from "@/components/Market/Sparkline";

export function ChokepointPanel({ box }: { box: any }) {
  const boxId = box?.id;
  const { data: hist } = useQuery({
    queryKey: ["map-history", boxId],
    queryFn: () => fetchMapHistory(boxId!, 720),
    enabled: !!boxId,
    staleTime: Infinity,
    gcTime: TTL_S["map:history"] * 1000,
  });
  if (!box) return null;
  const countsNorm = normalizeSeries((hist as any)?.counts);
  const crossingsNorm = normalizeSeries((hist as any)?.crossings);
  const sog: number[] = (hist as any)?.positions?.map?.((p: any) => p.sog) ?? (box.positions ?? []).map((p: any) => p.sog).filter((n: any) => typeof n === "number");
  const sparkData = countsNorm.length >= 2 ? countsNorm.slice(-20) : [];

  return (
    <div className="w-full bg-panel overflow-y-auto">
      <div className="sticky top-0 bg-panel border-b border-zinc-800 p-3 z-10">
        <h2 className="text-[16px] font-semibold">{box.name}</h2>
        <span className="font-mono text-[11px] text-zinc-500">{box.id}</span>
        {box.stale && <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">Seed · Stale</span>}
      </div>
      <div className="p-3 space-y-4">
        <div className="text-sm">
          <span className="font-mono tabular-nums">{box.count}</span> vs <span className="font-mono tabular-nums">{box.baseline_7d}</span>
          <span className={`ml-2 font-mono ${box.pct_change > 0 ? "text-emerald-400" : box.pct_change < 0 ? "text-red-400" : "text-zinc-500"}`}>
            {box.pct_change != null ? `${box.pct_change > 0 ? "+" : ""}${box.pct_change.toFixed(1)}%` : "—"}
          </span>
        </div>
        <div className="text-xs text-zinc-500 font-mono">{box.retrieved_at}</div>
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-dim">7d traffic trend</div>
          {sparkData.length >= 2 ? (
            <Sparkline data={sparkData} width={120} height={28} positive={(box.pct_change ?? 0) > 0} stale={!!box.stale} />
          ) : (
            <span className="text-xs text-ink-dim">History loading…</span>
          )}
        </div>
        <CrossingsChart counts={countsNorm} crossings={crossingsNorm} />
        <SogHistogram sog={sog} />
      </div>
    </div>
  );
}

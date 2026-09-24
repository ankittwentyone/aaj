import { Sparkline, toSparkline } from "./Sparkline";
import { useNavigate } from "react-router-dom";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { normalizeQuoteFromRecord } from "@/lib/normalizeQuote";

function buildEntries(
  indices?: Record<string, any>,
  commodities?: Record<string, any>,
  fx?: Record<string, any>,
  rates?: any,
): Array<[string, any]> {
  const rateEntries: Array<[string, any]> = rates ? [["US10Y", rates] as [string, any]] : [];
  return [
    ...Object.entries(indices ?? {}),
    ...Object.entries(commodities ?? {}),
    ...Object.entries(fx ?? {}),
    ...rateEntries,
  ];
}

export function IndexStrip({
  indices,
  commodities,
  fx,
  rates,
  selected,
  onSelect,
}: {
  indices?: Record<string, any>;
  commodities?: Record<string, any>;
  fx?: Record<string, any>;
  rates?: any;
  selected?: string;
  onSelect?: (ticker: string) => void;
}) {
  const nav = useNavigate();
  const entries = buildEntries(indices, commodities, fx, rates);

  return (
    <div className="grid gap-2 py-1 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {entries.map(([k, v]) => {
        const q = normalizeQuoteFromRecord(k, v);
        const changePct = q.changePct;
        const isUp =
          String(changePct).startsWith("+") ||
          (changePct && !String(changePct).startsWith("-") && Number(String(changePct).replace("%", "")) > 0);
        const spark = toSparkline(v?.payload ?? v);
        const isSelected = selected === k;

        return (
          <button
            key={k}
            type="button"
            onClick={() => onSelect?.(k)}
            onDoubleClick={() => nav(`/asset/${encodeURIComponent(k)}`)}
            title={`${k} — click to feature, double-click for asset desk`}
            className={`terminal-panel p-2.5 flex flex-col items-center gap-1 min-h-[92px] text-center hover:bg-hover transition-colors ${
              isSelected ? "ring-1 ring-voltage border-voltage-border" : ""
            }`}
          >
            <div className="flex items-center gap-1.5 w-full justify-center">
              <AssetIcon ticker={k} size={22} />
              <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-zinc-400 truncate">{k}</span>
              {q.stale && <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" title="STALE" />}
            </div>
            <div className={`font-mono tabular-nums text-sm font-semibold ${q.stale ? "opacity-50" : ""}`}>
              {q.displayPrice}
            </div>
            {changePct ? (
              <div className={`font-mono text-[11px] tabular-nums ${isUp ? "text-success" : "text-danger"}`}>{changePct}</div>
            ) : (
              <div className="h-[14px]" />
            )}
            <div className="w-[60px] h-[20px] flex-none flex items-center justify-center">
              {spark.length >= 2 ? (
                <Sparkline data={spark} width={60} height={20} positive={isUp} stale={q.stale} />
              ) : (
                <span className="inline-block w-full h-full rounded-sm bg-zinc-900/60 opacity-40" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

import { StockRow } from "./StockRow";
import { toSparkline } from "./Sparkline";
import { normalizeQuoteFromRecord } from "@/lib/normalizeQuote";

type Props = {
  indices?: Record<string, any>;
  commodities?: Record<string, any>;
  fx?: Record<string, any>;
  rates?: any;
  crypto?: Record<string, any>;
  title?: string;
};

export function Watchlist({ indices, commodities, fx, rates, crypto, title = "Watchlist" }: Props) {
  const groups: Array<{ label: string; entries: Array<[string, any]> }> = [
    { label: "Indices", entries: Object.entries(indices ?? {}) },
    { label: "Commodities", entries: Object.entries(commodities ?? {}) },
    { label: "FX & Rates", entries: [...Object.entries(fx ?? {}), ...(rates ? [["US10Y", rates] as [string, any]] : [])] },
    { label: "Crypto", entries: Object.entries(crypto ?? {}) },
  ].filter((g) => g.entries.length > 0);

  const allCount = groups.reduce((a, g) => a + g.entries.length, 0);

  if (allCount === 0) {
    return (
      <div className="terminal-panel p-4">
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400">{title}</div>
        <div className="text-sm text-zinc-500 mt-2">No watchlist data</div>
      </div>
    );
  }

  return (
    <div className="terminal-panel p-3 space-y-3">
      <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400 px-1">
        {title} · {allCount}
      </div>
      {groups.map((g) => (
        <div key={g.label} className="space-y-2">
          <div className="px-1 font-mono text-[10px] tracking-[0.06em] uppercase text-zinc-500">{g.label}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {g.entries.map(([k, v]) => {
              const q = normalizeQuoteFromRecord(k, v);
              const spark = toSparkline((v as any)?.payload ?? v);
              return (
                <StockRow
                  key={k}
                  variant="tile"
                  ticker={k}
                  price={q.displayPrice}
                  changePct={q.changePct}
                  spark={spark}
                  stale={q.stale}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkline, toSparkline } from "./Sparkline";
import { ChangeCell, parseChangePct } from "@/components/ui/ChangeCell";
import { normalizeQuoteFromRecord } from "@/lib/normalizeQuote";

type Row = {
  ticker: string;
  price: string;
  changePct: string;
  spark: number[];
  stale: boolean;
  abs: number;
};

type Group = { label: string; rows: Row[] };

function buildGroups(data: {
  indices?: Record<string, any>;
  commodities?: Record<string, any>;
  fx?: Record<string, any>;
  rates?: any;
  crypto?: Record<string, any>;
}): Group[] {
  const toRows = (entries: Array<[string, any]>): Row[] =>
    entries.map(([k, v]) => {
      const q = normalizeQuoteFromRecord(k, v);
      const { num } = parseChangePct(q.changePct);
      const spark = toSparkline((v as any)?.payload ?? v);
      return {
        ticker: k,
        price: q.displayPrice,
        changePct: q.changePct,
        spark,
        stale: q.stale,
        abs: num != null ? Math.abs(num) : 0,
      };
    });

  return [
    { label: "Indices", rows: toRows(Object.entries(data.indices ?? {})) },
    { label: "Commodities", rows: toRows(Object.entries(data.commodities ?? {})) },
    {
      label: "FX & Rates",
      rows: toRows([...Object.entries(data.fx ?? {}), ...(data.rates ? [["US10Y", data.rates] as [string, any]] : [])]),
    },
    { label: "Crypto", rows: toRows(Object.entries(data.crypto ?? {})) },
  ].filter((g) => g.rows.length > 0);
}

export function QuoteTable({
  data,
  selected,
  onSelect,
}: {
  data: {
    indices?: Record<string, any>;
    commodities?: Record<string, any>;
    fx?: Record<string, any>;
    rates?: any;
    crypto?: Record<string, any>;
  };
  selected: string;
  onSelect: (ticker: string) => void;
}) {
  const nav = useNavigate();
  const [sort, setSort] = useState<"symbol" | "change">("symbol");
  const groups = useMemo(() => buildGroups(data), [data]);

  const sortedGroups = useMemo(() => {
    if (sort === "symbol") return groups;
    return groups.map((g) => ({
      ...g,
      rows: [...g.rows].sort((a, b) => b.abs - a.abs),
    }));
  }, [groups, sort]);

  return (
    <div className="terminal-panel overflow-hidden">
      <div className="terminal-panel__head flex justify-between items-center gap-2">
        <span>Watchlist</span>
        <div className="flex gap-2 text-[10px] font-mono normal-case tracking-normal">
          <button type="button" onClick={() => setSort("symbol")} className={sort === "symbol" ? "text-ink" : "text-ink-muted"}>
            A–Z
          </button>
          <button type="button" onClick={() => setSort("change")} className={sort === "change" ? "text-ink" : "text-ink-muted"}>
            |%Δ|
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[min(52vh,520px)] overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-panel z-[1]">
            <tr className="text-[10px] font-mono uppercase tracking-[0.08em] text-ink-dim border-b border-border-subtle">
              <th className="text-left py-2 pl-3 pr-2 font-medium">Symbol</th>
              <th className="text-right py-2 px-2 font-medium">Last</th>
              <th className="text-right py-2 px-2 font-medium">Change</th>
              <th className="text-right py-2 pr-3 pl-2 font-medium w-[72px]">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sortedGroups.map((g) => (
              <Fragment key={g.label}>
                <tr className="bg-raised/50">
                  <td colSpan={4} className="py-1.5 pl-3 text-[10px] font-mono uppercase tracking-[0.08em] text-ink-dim">
                    {g.label}
                  </td>
                </tr>
                {g.rows.map((r) => {
                  const isUp =
                    String(r.changePct).startsWith("+") ||
                    (r.changePct && !String(r.changePct).startsWith("-") && parseChangePct(r.changePct).num! > 0);
                  const isSel = selected === r.ticker;
                  return (
                    <tr
                      key={r.ticker}
                      onClick={() => onSelect(r.ticker)}
                      onDoubleClick={() => nav(`/asset/${encodeURIComponent(r.ticker)}`)}
                      className={`cursor-pointer border-b border-border-subtle transition-colors ${
                        isSel ? "bg-hover ring-1 ring-inset ring-voltage-border" : "hover:bg-hover"
                      }`}
                    >
                      <td className="py-2 pl-3 pr-2 font-semibold font-mono text-[13px]">
                        {r.ticker}
                        {r.stale && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warning align-middle" title="Stale" />}
                      </td>
                      <td className="py-2 px-2 text-right font-mono tabular-nums">{r.price}</td>
                      <td className="py-2 px-2 text-right">
                        <ChangeCell changePct={r.changePct} size="sm" />
                      </td>
                      <td className="py-2 pr-3 pl-2 text-right">
                        <span className="inline-flex justify-end w-[60px]">
                          {r.spark.length >= 2 ? (
                            <Sparkline data={r.spark} width={60} height={20} positive={isUp} stale={r.stale} />
                          ) : (
                            <span className="inline-block w-[60px] h-[20px] bg-zinc-900/50 rounded-sm" />
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

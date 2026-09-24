import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchHome, fetchCrossMarket, fetchAsset } from "@/api/client";
import { TTL_S } from "@/lib/ttls";
import { AnomalyStrip } from "@/components/Market/AnomalyStrip";
import { QuoteTable } from "@/components/Market/QuoteTable";
import { StockRow } from "@/components/Market/StockRow";
import { toSparkline } from "@/components/Market/Sparkline";
import { HeatmapMatrix, matrixToCells } from "@/components/charts/HeatmapMatrix";
import { ChartPanel } from "@/components/Asset/ChartPanel";
import { normalizeQuoteFromRecord } from "@/lib/normalizeQuote";
import { useInstrument } from "@/context/InstrumentContext";
import { ChangeCell } from "@/components/ui/ChangeCell";

function collectMovers(data: any): Array<{ ticker: string; changePct: string; price: string; spark: number[]; stale: boolean }> {
  const buckets = { ...data?.indices, ...data?.commodities, ...data?.crypto, ...data?.fx };
  const rows: Array<{ ticker: string; changePct: string; price: string; spark: number[]; stale: boolean; abs: number }> = [];
  for (const [k, v] of Object.entries(buckets ?? {})) {
    const q = normalizeQuoteFromRecord(k, v);
    const pct = Number(String(q.changePct).replace("%", "").replace("+", ""));
    if (Number.isNaN(pct)) continue;
    rows.push({
      ticker: k,
      changePct: q.changePct,
      price: q.displayPrice,
      spark: toSparkline((v as any)?.payload ?? v),
      stale: q.stale,
      abs: Math.abs(pct),
    });
  }
  return rows.sort((a, b) => b.abs - a.abs).slice(0, 5);
}

export default function MarketHome() {
  const nav = useNavigate();
  const { ticker: focusTicker, setTicker } = useInstrument();
  const { data, isLoading, error } = useQuery({
    queryKey: ["home"],
    queryFn: fetchHome,
    staleTime: Infinity,
    gcTime: TTL_S["market-home"] * 1000,
    refetchInterval: TTL_S["market-home"] * 1000,
  });
  const { data: cross, isLoading: crossLoading, isError: crossError } = useQuery({
    queryKey: ["cross-market"],
    queryFn: fetchCrossMarket,
    staleTime: Infinity,
    gcTime: TTL_S["cross-market"] * 1000,
  });
  const { data: focusAsset, isLoading: chartLoading } = useQuery({
    queryKey: ["asset", focusTicker],
    queryFn: () => fetchAsset(focusTicker),
    staleTime: Infinity,
    gcTime: TTL_S["asset:quote"] * 1000,
  });

  useEffect(() => {
    if (!data) return;
    const all = { ...data.indices, ...data.commodities };
    if (focusTicker && !all[focusTicker] && data.commodities?.BRENT) setTicker("BRENT");
  }, [data, focusTicker, setTicker]);

  if (isLoading) return <div className="terminal-page p-8 text-ink-muted">Loading market home…</div>;
  if (error) return <div className="terminal-page p-8 text-danger">Failed to load market home</div>;

  const focusQuote = normalizeQuoteFromRecord(focusTicker, data?.commodities?.[focusTicker] ?? data?.indices?.[focusTicker] ?? data?.fx?.[focusTicker]);
  const { cells, rows, cols } = matrixToCells((cross as any)?.matrix ?? (cross as any)?.exposures ?? cross, focusTicker);
  const movers = collectMovers(data);

  return (
    <div className="terminal-page flex flex-col gap-3 min-h-0 flex-1">
      <div className="terminal-breakout">
        <AnomalyStrip strip={data?.anomaly_strip} />
      </div>

      <div className="terminal-grid-12 flex-1 auto-rows-min gap-3">
        <div className="col-span-12 lg:col-span-5 min-h-0">
          <QuoteTable
            data={{
              indices: data?.indices,
              commodities: data?.commodities,
              fx: data?.fx,
              rates: data?.rates,
              crypto: data?.crypto,
            }}
            selected={focusTicker}
            onSelect={setTicker}
          />
        </div>

        <div className="col-span-12 lg:col-span-7 flex flex-col gap-3">
          <div className="terminal-panel terminal-panel--flush min-h-[400px] flex-1">
            <div className="terminal-panel__head flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-3 normal-case tracking-normal">
                <span className="font-semibold text-base">{focusTicker}</span>
                <span className="font-mono tabular-nums text-lg">{focusQuote.displayPrice}</span>
                <ChangeCell changePct={focusQuote.changePct} size="md" />
              </div>
              <div className="flex gap-3 text-xs">
                <Link to={`/asset/${encodeURIComponent(focusTicker)}`} className="text-ink-muted hover:text-ink">Asset →</Link>
                <Link
                  to={`/research?research=${encodeURIComponent(`Why is ${focusTicker} moving today?`)}`}
                  className="text-voltage hover:underline"
                >
                  Desk →
                </Link>
              </div>
            </div>
            {chartLoading ? (
              <div className="p-8 text-sm text-ink-muted">Loading chart…</div>
            ) : (
              <ChartPanel rawChart={focusAsset?.chart} featured evidence={focusAsset?.chart} />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="terminal-panel p-3">
              <div className="terminal-panel__head border-0 px-0 pt-0 pb-2">Top movers</div>
              <div className="space-y-1">
                {movers.map((m) => (
                  <StockRow key={m.ticker} ticker={m.ticker} price={m.price} changePct={m.changePct} spark={m.spark} stale={m.stale} />
                ))}
              </div>
            </div>
            <div className="terminal-panel p-3">
              <div className="terminal-panel__head border-0 px-0 pt-0 pb-2">Headlines</div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {(data?.event_ticker ?? []).slice(0, 6).map((e: any, i: number) => (
                  <Link
                    key={i}
                    to={`/events?q=${encodeURIComponent(e.payload?.title ?? e.title ?? "")}`}
                    className="block text-sm leading-snug border-b border-border-subtle py-2 hover:text-ink"
                  >
                    {e.payload?.title ?? e.title ?? ""}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 terminal-panel p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted">Cross-market sensitivity</span>
            <Link to={`/cross-market?shock=${encodeURIComponent(focusTicker)}`} className="text-xs text-voltage hover:underline">
              Open full cross-market →
            </Link>
          </div>
          {rows.length > 0 && cols.length > 0 ? (
            <HeatmapMatrix
              cells={cells}
              rows={rows}
              cols={cols}
              domain={[-1, 1]}
              onCellClick={(cell) => nav(`/cross-market?shock=${encodeURIComponent(cell.row)}`)}
            />
          ) : crossError ? (
            <div className="text-sm text-danger">Matrix unavailable</div>
          ) : crossLoading ? (
            <div className="text-sm text-ink-muted">Loading matrix…</div>
          ) : (
            <div className="text-sm text-ink-muted">No matrix data</div>
          )}
        </div>
      </div>
    </div>
  );
}

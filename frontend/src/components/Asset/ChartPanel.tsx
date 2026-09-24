import { useEffect, useRef } from "react";
import { createChart, ColorType, AreaSeries, HistogramSeries, CandlestickSeries } from "lightweight-charts";
import { _normalize_chart } from "@/lib/normalizeChart";
import { EvidenceChip } from "@/components/EvidenceChip";

export function ChartPanel({
  rawChart,
  compact = false,
  featured = false,
  evidence,
}: {
  rawChart: any;
  compact?: boolean;
  featured?: boolean;
  evidence?: any;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const { rows } = _normalize_chart(rawChart);
  const mainH = featured
    ? 340
    : compact
      ? 252
      : Math.min(420, Math.max(320, typeof window !== "undefined" ? window.innerHeight * 0.38 : 360));
  const chartRecord = rawChart?.payload ? rawChart : evidence ?? rawChart;
  const chartStale = chartRecord?.stale === true || chartRecord?.status === "skipped";
  const isSkipped =
    rawChart?.status === "skipped" ||
    rawChart?.payload?.status === "skipped" ||
    (rows.length === 0 && rawChart?.status === "skipped");
  const skipReason = rawChart?.reason ?? rawChart?.payload?.reason ?? rawChart?.payload?.Information ?? "";
  const vols = rows.map((r) => r.volume).filter((v): v is number => typeof v === "number" && v > 0);
  const hasVol = vols.length > 0;
  const hasOhlc = rows.some((r) => r.open != null && r.high != null && r.low != null);
  const lastClose = rows.length ? rows[rows.length - 1].close : 0;
  const firstClose = rows.length ? rows[0].close : 0;
  const up = lastClose >= firstClose;

  useEffect(() => {
    if (!ref.current || rows.length === 0) return;
    const w = ref.current.clientWidth || 400;
    const chart = createChart(ref.current, {
      width: w,
      height: mainH,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#A1A1AA" },
      grid: { vertLines: { color: "#232327" }, horzLines: { color: "#232327" } },
      rightPriceScale: { borderColor: "#2E2E34" },
      timeScale: { borderColor: "#2E2E34" },
    });
    if (hasOhlc) {
      const cs = chart.addSeries(CandlestickSeries, {
        upColor: "#4ADE80",
        downColor: "#FF4444",
        borderVisible: false,
        wickUpColor: "#4ADE80",
        wickDownColor: "#FF4444",
      });
      cs.setData(
        rows.map((r) => ({
          time: r.ts as any,
          open: r.open ?? r.close,
          high: r.high ?? r.close,
          low: r.low ?? r.close,
          close: r.close,
        })),
      );
    } else {
      const series = chart.addSeries(AreaSeries, {
        topColor: up ? "rgba(74, 222, 128, 0.28)" : "rgba(255, 68, 68, 0.22)",
        bottomColor: up ? "rgba(74, 222, 128, 0.02)" : "rgba(255, 68, 68, 0.02)",
        lineColor: up ? "#4ADE80" : "#FF4444",
        lineWidth: 2,
        crosshairMarkerVisible: true,
      });
      series.setData(rows.map((r) => ({ time: r.ts as any, value: r.close })));
    }
    let volChart: ReturnType<typeof createChart> | null = null;
    if (hasVol && volRef.current) {
      volChart = createChart(volRef.current, {
        width: w,
        height: 84,
        layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#71717a" },
        grid: { vertLines: { visible: false }, horzLines: { color: "#232327" } },
        rightPriceScale: { visible: false },
        timeScale: { visible: false },
      });
      const hist = volChart.addSeries(HistogramSeries, {
        color: "rgba(113,113,122,0.6)",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      hist.setData(rows.map((r) => ({ time: r.ts as any, value: r.volume ?? 0 })));
    }
    const ro = new ResizeObserver(() => {
      const nw = ref.current?.clientWidth ?? w;
      chart.applyOptions({ width: nw });
      volChart?.applyOptions({ width: nw });
    });
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.remove();
      volChart?.remove();
    };
  }, [rows, hasVol, hasOhlc, mainH, up]);

  if (rows.length === 0) {
    return (
      <div className="terminal-panel terminal-panel--flush">
        {isSkipped && (
          <div className="flex items-center gap-2 px-3 py-2 bg-warning-dim border-b border-warning-border">
            <span className="text-[11px] font-semibold uppercase text-warning">Chart unavailable</span>
            <span className="text-[11px] font-mono text-zinc-400 truncate">{skipReason || "Provider skipped or rate limited"}</span>
          </div>
        )}
        <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 text-sm p-8 text-center" style={{ minHeight: mainH }}>
          No price history yet — check API keys or retry shortly.
        </div>
      </div>
    );
  }
  return (
    <div className="terminal-panel terminal-panel--flush w-full">
      {(chartRecord?.provider || chartStale) && (
        <div className="px-3 py-1.5 border-b border-border-subtle flex flex-wrap gap-2 items-center">
          <EvidenceChip
            provider={chartRecord?.provider ?? "market"}
            dataset={chartRecord?.dataset ?? "chart"}
            query={chartRecord?.query}
            source_url={chartRecord?.source_url}
            retrieved_at={chartRecord?.retrieved_at}
            stale={chartStale}
          />
        </div>
      )}
      {isSkipped && (
        <div className="flex items-center gap-2 px-3 py-2 bg-warning-dim border-b border-warning-border">
          <span className="text-[11px] font-semibold uppercase text-warning">Cached fallback</span>
          <span className="text-[11px] font-mono text-zinc-400 truncate">{skipReason}</span>
        </div>
      )}
      <div ref={ref} className="w-full" style={{ height: mainH }} />
      {hasVol && <div ref={volRef} className="w-full h-[84px] border-t border-border-subtle" />}
    </div>
  );
}

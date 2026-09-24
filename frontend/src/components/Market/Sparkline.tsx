import { useEffect, useRef } from "react";
import { createChart, ColorType, AreaSeries } from "lightweight-charts";
import { assertChartSize } from "@/lib/guardrails";

// 60×20 inline sparkline — lightweight-charts AreaSeries gradient 0.14→0
// Spec: stroke 1.5px, fill gradient 0.14 opacity to bottom, radius 0
// API: GET /api/market-home tail slice, GET /api/map/{id}/history counts
export function Sparkline({
  data,
  width = 60,
  height = 20,
  positive = true,
  stale = false,
}: {
  data: number[];
  width?: number;
  height?: number;
  positive?: boolean;
  stale?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || data.length < 2) return;
    // MIN 520 gate does NOT apply to 60×20 inline — these are always rendered
    // but we guard against zero width during SSR
    const w = width;
    const h = height;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    const chart = createChart(ref.current, {
      width: w,
      height: h,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "transparent" },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
      handleScroll: false,
      handleScale: false,
    });
    const lineColor = stale ? "#71717a" : positive ? "#10b981" : "#ef4444";
    const topColor = stale ? "rgba(113,113,122,0.12)" : positive ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.22)";
    const bottomColor = stale ? "rgba(113,113,122,0.00)" : positive ? "rgba(16,185,129,0.02)" : "rgba(239,68,68,0.00)";
    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor,
      bottomColor,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    // lightweight-charts expects time-indexed data
    series.setData(data.map((v, i) => ({ time: (i + 1) as any, value: v })));
    chart.timeScale().fitContent();
    // retina: canvas already handles dpr via width*devicePixelRatio internally
    return () => chart.remove();
  }, [data, width, height, positive, stale]);

  if (data.length < 2) {
    return <div style={{ width, height }} className="flex-none bg-zinc-900 rounded-sm opacity-40" />;
  }
  return (
    <div
      ref={ref}
      style={{ width, height }}
      className={`flex-none overflow-hidden rounded-sm ${stale ? "opacity-50" : ""}`}
      aria-hidden
    />
  );
}

// Tiny helper to derive sparkline array from heterogeneous payloads
export function toSparkline(payload: any): number[] {
  if (!payload) return [];
  // chart.tail or rows close
  if (Array.isArray(payload.tail)) return payload.tail.map((r: any) => r.close ?? r.value ?? r.price ?? 0).filter((n: any) => typeof n === "number");
  if (Array.isArray(payload.rows)) return payload.rows.slice(-20).map((r: any) => r.close ?? r.value ?? 0);
  if (Array.isArray(payload.history)) return payload.history.slice(-20);
  if (Array.isArray(payload)) return payload.slice(-20);
  // Global Quote fallback — single price gives flat line
  const price = payload?.["Global Quote"]?.["05. price"] ?? payload?.price;
  if (price) return [Number(price) - 1, Number(price)];
  return [];
}

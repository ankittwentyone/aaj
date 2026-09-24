import { useEffect, useRef } from "react";
import { createChart, ColorType, HistogramSeries } from "lightweight-charts";
// Histogram h84 gap1 — counts vs crossings drift handled: both accept number[] or {ts,vessels}[] or {time,value}[]
export function normalizeSeries(arr: any): number[] {
  if (!arr) return [];
  if (Array.isArray(arr) && arr.length && typeof arr[0] === "object" && !Array.isArray(arr[0])) {
    // {ts, vessels} or {time,value} or {count} — backend history crossings use {ts,direction,crossings}
    return arr.map((o: any) => o.vessels ?? o.value ?? o.count ?? o.crossings ?? o.y ?? 0);
  }
  if (Array.isArray(arr)) return arr as number[];
  return [];
}

function p95(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.95)] ?? null;
}

export function CrossingsChart({ counts, crossings }: { counts: any; crossings: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const histRef = useRef<HTMLDivElement>(null);
  const countsNorm = normalizeSeries(counts);
  const crossingsNorm = normalizeSeries(crossings);
  const data = countsNorm.length ? countsNorm : crossingsNorm;
  const marker = p95(data);

  useEffect(() => {
    if (!ref.current) return;
    const w = ref.current.clientWidth;
    const h = 84;
    if (w < 280) return;
    if (!data.length) return;
    const chart = createChart(ref.current, {
      width: w,
      height: h,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#A1A1AA" },
      grid: { vertLines: { visible: false }, horzLines: { color: "#232327" } },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
    });
    const series = chart.addSeries(HistogramSeries, { color: "rgba(113,113,122,0.6)", priceLineVisible: false, lastValueVisible: false });
    series.setData(data.map((v, i) => ({ time: (i + 1) as any, value: v })));
    // avoid ResizeObserver loop: debounce via rAF
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => chart.applyOptions({ width: ref.current!.clientWidth }));
    });
    ro.observe(ref.current);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      chart.remove();
    };
  }, [data]);

  // gap handling: if both provided show two stacked histos (counts top, crossings bottom)
  if (countsNorm.length && crossingsNorm.length) {
    return (
      <div className="space-y-2">
        <div className="font-mono text-[10px] tracking-[0.06em] uppercase text-zinc-500">Vessels 84h</div>
        <div ref={ref} className="h-[84px] w-full border border-zinc-800 rounded-md overflow-hidden" />
        {marker != null && <div className="text-[10px] font-mono text-amber-400">p95 {marker} vessels</div>}
        <div className="font-mono text-[10px] tracking-[0.06em] uppercase text-zinc-500">Crossings / hour 84h</div>
        <div ref={histRef} className="h-[84px] w-full border border-zinc-800 rounded-md overflow-hidden bg-zinc-900 flex items-end gap-px p-1">
          {crossingsNorm.slice(-48).map((v, i) => (
            <div key={i} className="flex-1 bg-zinc-500 rounded-sm" style={{ height: `${Math.max(2, (v / Math.max(...crossingsNorm, 1)) * 70)}px` }} title={`${v}`} />
          ))}
        </div>
        {countsNorm.length === 0 && crossingsNorm.length === 0 && <div className="text-xs text-zinc-600">No history — seed replay</div>}
      </div>
    );
  }

  const w = ref.current?.clientWidth ?? 400;
  if (typeof window !== "undefined" && w < 520 && data.length > 0) {
    return (
      <div className="space-y-1">
        <div className="flex gap-px h-[84px] items-end p-1 border border-zinc-800 rounded-md overflow-hidden bg-zinc-950">
          {data.slice(-48).map((v, i) => (
            <div key={i} className="flex-1 bg-zinc-500 rounded-sm" style={{ height: `${Math.max(2, (v / Math.max(...data, 1)) * 72)}px` }} title={`${v}`} />
          ))}
        </div>
      </div>
    );
  }
  if (!data.length) return <div className="h-[84px] flex items-center justify-center text-zinc-600 text-xs border border-zinc-800 rounded-md">No counts/crossings — history empty</div>;
  return (
    <div className="space-y-1">
      <div ref={ref} className="h-[84px] w-full border border-zinc-800 rounded-md overflow-hidden" />
      {marker != null && <div className="text-[10px] font-mono text-amber-400">p95 {marker}</div>}
      {/* micro SOG histogram 15 bins 0-30kn if s-o-g present in crossings payload */}
      <div className="text-[10px] font-mono text-zinc-600">Histogram • h84 gap1 • bar zinc-500 • p95 amber 1px</div>
    </div>
  );
}

// Standalone SOG histogram 15 bins 0-30kn
export function SogHistogram({ sog }: { sog: number[] }) {
  if (!sog?.length) return <div className="h-[84px] flex items-center justify-center text-zinc-600 text-xs border border-zinc-800 rounded-md">SOG empty</div>;
  const bins = 15;
  const max = 30;
  const counts = new Array(bins).fill(0);
  for (const v of sog) {
    const idx = Math.min(bins - 1, Math.floor((v / max) * bins));
    counts[idx]++;
  }
  const peak = Math.max(...counts, 1);
  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] tracking-[0.06em] uppercase text-zinc-500">SOG 0–30kn 15 bins</div>
      <div className="flex gap-px h-[84px] items-end p-1 border border-zinc-800 rounded-md bg-zinc-950">
        {counts.map((c, i) => (
          <div key={i} className="flex-1 bg-zinc-500 rounded-sm" style={{ height: `${Math.max(2, (c / peak) * 72)}px` }} title={`${(i * max) / bins | 0}-${((i + 1) * max) / bins | 0}kn: ${c}`} />
        ))}
      </div>
    </div>
  );
}

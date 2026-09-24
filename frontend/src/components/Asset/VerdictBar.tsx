import { assertChartSize } from "@/lib/guardrails";

export function VerdictBar({ priceDelta, physicalDelta }: { priceDelta: number; physicalDelta: number }) {
  const w = typeof window !== "undefined" ? window.innerWidth : 600;
  // MIN 520px gate — below that, switch to stacked pills
  if (assertChartSize(w, 240) === "sparkline_fallback") {
    return (
      <div className="flex flex-col gap-2">
        <div className="risk-pill risk-pill--info">Physical {physicalDelta > 0 ? "+" : ""}{physicalDelta}%</div>
        <div className="risk-pill risk-pill--high">Narrative {priceDelta > 0 ? "+" : ""}{priceDelta}%</div>
      </div>
    );
  }
  // Diverging bar — pure div + CSS, NO d3 import — h44 diverging 44 bar per G-020
  const maxAbs = Math.max(Math.abs(priceDelta), Math.abs(physicalDelta), 5);
  const leftW = (Math.abs(physicalDelta) / maxAbs) * 50;
  const rightW = (Math.abs(priceDelta) / maxAbs) * 50;
  return (
    <div className="w-full h-11 rounded-pill bg-raised flex items-center overflow-hidden border border-border-subtle" style={{ height: 44 }}>
      <div className="flex-1 flex justify-end"><div style={{ width: `${leftW}%` }} className="h-6 bg-success rounded-l-pill" /></div>
      <div className="w-px h-11 bg-border-strong shrink-0" style={{ height: 44 }} />
      <div className="flex-1 flex justify-start"><div style={{ width: `${rightW}%` }} className="h-6 bg-warning rounded-r-pill" /></div>
    </div>
  );
}

export function MarketLegend() {
  return (
    <div className="h-7 flex items-center gap-4 px-4 lg:px-5 text-[10px] font-mono uppercase tracking-[0.06em] text-ink-dim border-b border-border-subtle bg-canvas">
      <span><span className="text-success">▲</span> Up</span>
      <span><span className="text-danger">▼</span> Down</span>
      <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Stale seed</span>
      <span className="hidden md:inline text-ink-faint">Click row → chart · Double-click → asset</span>
    </div>
  );
}

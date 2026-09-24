// Framer isolated — dynamic import only on MarketHome ticker marquee
import { useEffect, useState } from "react";
import { Sparkline } from "./Sparkline";

export function TickerMarquee({ items, sparklines }: { items: string[]; sparklines?: Record<string, number[]> }) {
  const [MotionDiv, setMotionDiv] = useState<any>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    import("framer-motion").then((m) => setMotionDiv(() => m.motion.div));
  }, []);
  const row = (
    <span className="flex gap-6 items-center">
      {items.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-mono text-[11px] text-zinc-400">{t}</span>
          {sparklines?.[t] && <Sparkline data={sparklines[t]} width={60} height={20} positive={sparklines[t][sparklines[t].length-1] > sparklines[t][0]} />}
        </span>
      ))}
    </span>
  );
  if (!MotionDiv)
    return (
      <div className="flex gap-4 overflow-hidden text-xs text-zinc-500 border-y border-zinc-800 py-1.5">
        {row}
      </div>
    );
  return (
    <div className="overflow-hidden border-y border-zinc-800 py-1.5 bg-zinc-950">
      <MotionDiv animate={{ x: ["0%", "-50%"] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="flex gap-6 whitespace-nowrap text-xs text-zinc-500">
        {row}
        <span className="mx-4 text-zinc-700">·</span>
        {row}
      </MotionDiv>
    </div>
  );
}

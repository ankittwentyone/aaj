import { useEffect, useState, useMemo } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { subscribeHighlight, getHighlight } from "@/lib/linkedHighlight";

// Treemap squarify ratio 1.6, padding 2, label if w>72, color by exposure sign
// Data: exposures[] from POST /api/cross-market/simulate or GET /api/cross-market sectors

type Tile = { name: string; value: number; exposure: number; rationale?: string };

export function TreemapSectors({ tiles, stale = false, onTileClick }: { tiles: Tile[]; stale?: boolean; onTileClick?: (t: Tile) => void }) {
  const [hl, setHl] = useState(getHighlight());
  useEffect(() => subscribeHighlight(() => setHl(getHighlight())), []);

  const layout = useMemo(() => {
    if (!tiles.length) return [];
    const root = hierarchy({ children: tiles } as any).sum((d: any) => Math.max(1, Math.abs(d.exposure ?? d.value ?? 1)));
    // fixed container: w 100% h 280 → we compute at 720×280 then scale via % 
    // Use d3 treemap with squarify ratio 1.6
    const tm = treemap<any>().tile(treemapSquarify.ratio(1.6)).size([720, 280]).paddingInner(2).paddingOuter(2);
    tm(root);
    return root.leaves() as any[];
  }, [tiles]);

  if (stale) {
    return <div className="w-full h-[280px] bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-600 text-sm">— treemap stale —</div>;
  }
  if (!tiles.length) {
    return <div className="w-full h-[280px] border border-dashed border-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 text-sm">No sector exposures — move slider</div>;
  }

  return (
    <div className="relative w-full h-[280px] bg-zinc-950 border border-zinc-800 rounded-[8px] overflow-hidden">
      {layout.map((node: any, i: number) => {
        const d: Tile = node.data;
        const x0 = node.x0, y0 = node.y0, x1 = node.x1, y1 = node.y1;
        const w = x1 - x0, h = y1 - y0;
        const isPos = (d.exposure ?? d.value ?? 0) > 0;
        const bg = isPos ? "rgba(16,185,129,0.82)" : (d.exposure ?? d.value) < 0 ? "rgba(239,68,68,0.82)" : "#27272a";
        const showLabel = w > 72 && h > 28;
        const isHighlighted = hl?.commodity === d.name;
        return (
          <button
            key={i}
            onClick={() => onTileClick?.(d)}
            className={`absolute flex flex-col items-center justify-center p-1 text-center transition-all hover:brightness-110 ${isHighlighted ? "ring-2 ring-white z-10" : ""}`}
            style={{
              left: `${(x0 / 720) * 100}%`,
              top: `${(y0 / 280) * 100}%`,
              width: `${(w / 720) * 100}%`,
              height: `${(h / 280) * 100}%`,
              background: bg,
              borderRadius: 4,
            }}
            title={`${d.name}: ${d.exposure > 0 ? "+" : ""}${d.exposure?.toFixed?.(2) ?? d.value} · ${d.rationale ?? ""}`}
          >
            {showLabel ? (
              <>
                <span className="text-[11px] font-mono font-semibold text-white truncate w-full">{d.name}</span>
                <span className="text-[10px] font-mono text-white/80">{d.exposure > 0 ? "+" : ""}{d.exposure?.toFixed?.(1) ?? ""}</span>
              </>
            ) : w > 28 ? (
              <span className="text-[10px] font-mono text-white">{d.name.slice(0, 3)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

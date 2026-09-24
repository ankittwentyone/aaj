import { useEffect, useState } from "react";
import { subscribeHighlight, getHighlight } from "@/lib/linkedHighlight";

// 44×28 heatmap matrix — diverging RdYlGn at 0, gap 2, font 11px mono
// Spec: cell 44×28 gap2 radius4, lightweight-charts heatmap mental model but div grid for 60fps
// Data: GET /api/cross-market matrix or POST /api/cross-market/simulate exposures
type Cell = { row: string; col: string; value: number; weight?: number; rationale?: string; solid?: boolean };

function colorFor(v: number, domain: [number, number]): string {
  // diverging emerald→zinc→red at 0
  // domain e.g. [-1,1] or [-40,40]
  const [min, max] = domain;
  const clamped = Math.max(min, Math.min(max, v));
  if (clamped === 0) return "#27272a"; // zinc-800
  if (clamped > 0) {
    const t = clamped / max; // 0..1
    // emerald scale: zinc-800 → emerald-500 #10b981
    // interpolate opacity
    const alpha = 0.15 + t * 0.85;
    return `rgba(16,185,129,${alpha.toFixed(2)})`;
  } else {
    const t = Math.abs(clamped) / Math.abs(min);
    const alpha = 0.15 + t * 0.85;
    return `rgba(239,68,68,${alpha.toFixed(2)})`;
  }
}

export function HeatmapMatrix({
  cells,
  rows,
  cols,
  domain = [-1, 1],
  onCellClick,
  stale = false,
}: {
  cells: Cell[];
  rows: string[];
  cols: string[];
  domain?: [number, number];
  onCellClick?: (cell: Cell) => void;
  stale?: boolean;
}) {
  const [highlight, setHl] = useState(getHighlight());
  useEffect(() => subscribeHighlight(() => setHl(getHighlight())), []);

  const map = new Map<string, Cell>();
  for (const c of cells) map.set(`${c.row}::${c.col}`, c);

  if (stale) {
    return (
      <div className="grid gap-2 p-3" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 44px)` }}>
        {rows.map((r) => cols.map((col) => <div key={`${r}-${col}`} className="w-[44px] h-[28px] rounded-[4px] bg-zinc-900 flex items-center justify-center text-[11px] font-mono text-zinc-600">—</div>))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[2px] p-3" style={{ gridTemplateColumns: `72px repeat(${cols.length}, 44px)` }}>
        {/* header row */}
        <div className="h-[28px]" />
        {cols.map((c) => (
          <div key={`h-${c}`} className="w-[44px] h-[28px] flex items-center justify-center text-[10px] font-mono tracking-[0.06em] uppercase text-zinc-500 truncate" title={c}>
            {c.slice(0, 6)}
          </div>
        ))}
        {rows.map((r) => (
          <>
            <div key={`r-${r}`} className="h-[28px] flex items-center text-[11px] font-mono text-zinc-400 truncate pr-2" title={r}>
              {r}
            </div>
            {cols.map((col) => {
              const cell = map.get(`${r}::${col}`);
              const v = cell?.value ?? 0;
              const bg = colorFor(v, domain);
              const isHighlighted = highlight?.commodity === r || highlight?.commodity === col;
              return (
                <button
                  key={`${r}-${col}`}
                  onClick={() => cell && onCellClick?.(cell)}
                  className={`w-[44px] h-[28px] rounded-[4px] flex items-center justify-center text-[11px] font-mono tabular-nums border transition-all ${isHighlighted ? "border-white ring-1 ring-white" : cell?.solid === false ? "border-amber-400/50 border-dashed" : "border-transparent"} hover:brightness-110`}
                  style={{ background: bg }}
                  title={cell ? `${r}→${col}: ${v > 0 ? "+" : ""}${v.toFixed(2)}${cell.rationale ? ` · ${cell.rationale}` : ""}` : `${r}→${col}: —`}
                >
                  <span className={Math.abs(v) > 0.4 ? "text-white" : "text-zinc-200"}>{cell ? `${v > 0 ? "+" : ""}${v.toFixed(1)}` : "—"}</span>
                </button>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

// Convenience adapter for backend matrix shape
export function matrixToCells(matrix: any, defaultShock = "BRENT"): { cells: Cell[]; rows: string[]; cols: string[] } {
  if (!matrix) return { cells: [], rows: [], cols: [] };
  // exposures array from simulate: [{target, exposure, weight, rationale}]
  if (Array.isArray(matrix)) {
    const rows = Array.from(new Set(matrix.map((e: any) => e.shock_asset ?? defaultShock)));
    const cols = Array.from(new Set(matrix.map((e: any) => e.target ?? e.sector ?? e.col).filter(Boolean)));
    const cells = matrix.map((e: any) => ({
      row: e.shock_asset ?? defaultShock,
      col: e.target ?? e.sector ?? "",
      value: e.exposure ?? e.weight ?? 0,
      weight: e.weight,
      rationale: e.rationale,
      solid: true,
    }));
    return { cells, rows: rows as string[], cols };
  }
  if (typeof matrix === "object") {
    const rows = Object.keys(matrix);
    const first = matrix[rows[0]];
    // Curated GET /api/cross-market: { BRENT: [{ target, weight, direction, rationale }, ...] }
    if (Array.isArray(first)) {
      const allCols = new Set<string>();
      const cells: Cell[] = [];
      for (const r of rows) {
        const edges = matrix[r];
        if (!Array.isArray(edges)) continue;
        for (const e of edges) {
          const col = e.target ?? e.sector ?? "";
          if (!col) continue;
          allCols.add(col);
          const dir = e.direction ?? 1;
          const w = e.weight ?? e.exposure ?? 0;
          cells.push({
            row: r,
            col,
            value: typeof w === "number" ? w * dir : 0,
            weight: w,
            rationale: e.rationale,
            solid: true,
          });
        }
      }
      return { cells, rows, cols: Array.from(allCols) };
    }
    const allCols = new Set<string>();
    for (const r of rows) {
      const rowObj = matrix[r];
      if (rowObj && typeof rowObj === "object" && !Array.isArray(rowObj)) Object.keys(rowObj).forEach((c) => allCols.add(c));
    }
    const cols = Array.from(allCols);
    const cells: Cell[] = [];
    for (const r of rows) {
      for (const c of cols) {
        const v = matrix[r]?.[c];
        if (v !== undefined) cells.push({ row: r, col: c, value: typeof v === "number" ? v : v?.exposure ?? v?.weight ?? 0, solid: true });
      }
    }
    return { cells, rows, cols };
  }
  return { cells: [], rows: [], cols: [] };
}

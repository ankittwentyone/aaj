import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useInstrument } from "@/context/InstrumentContext";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { useQuery } from "@tanstack/react-query";
import { fetchCrossMarket, fetchSimulate } from "@/api/client";
import { TTL_S } from "@/lib/ttls";
import { HeatmapMatrix, matrixToCells } from "@/components/charts/HeatmapMatrix";
import { TreemapSectors } from "@/components/charts/TreemapSectors";

const COMMODITY_SHOCKS = new Set(["BRENT", "WTI", "NATGAS"]);

export default function CrossMarketPage() {
  const [params] = useSearchParams();
  const { ticker } = useInstrument();
  const shockFromUrl = params.get("shock");
  const { data: matrix } = useQuery({ queryKey: ["cross-market"], queryFn: fetchCrossMarket, staleTime: Infinity, gcTime: TTL_S["cross-market"] * 1000 });
  const [shock, setShock] = useState(10);
  const [shockAsset, setShockAsset] = useState(() => {
    const s = (shockFromUrl ?? (COMMODITY_SHOCKS.has(ticker) ? ticker : "BRENT")).toUpperCase();
    return COMMODITY_SHOCKS.has(s) ? s : "BRENT";
  });
  const [exposures, setExposures] = useState<any[] | null>(null);
  const [exposedChokepoints, setExposedChokepoints] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const timerRef = useRef<number | null>(null);

  const doSimulate = useCallback(async (v: number) => {
    setPending(true);
    try {
      const r: any = await fetchSimulate(shockAsset, v);
      setExposures(r.exposures ?? r.data ?? []);
      setExposedChokepoints(r.exposed_chokepoints ?? r.exposedChokepoints ?? []);
    } catch {
      // keep previous value visible (no blank)
    } finally {
      setPending(false);
    }
  }, [shockAsset]);

  function onShock(v: number) {
    setShock(v);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => doSimulate(v), 150);
  }

  useEffect(() => {
    if (shockFromUrl) {
      const s = shockFromUrl.toUpperCase();
      if (s === "BRENT" || s === "WTI" || s === "NATGAS") setShockAsset(s);
    }
  }, [shockFromUrl]);

  useEffect(() => {
    doSimulate(shock);
  }, [shockAsset]); // eslint-disable-line react-hooks/exhaustive-deps -- initial + asset switch

  // Derive heatmap inputs: prefer simulated exposures, fallback to GET /api/cross-market matrix
  const source = exposures ?? (matrix as any)?.matrix ?? matrix;
  const { cells, rows, cols } = matrixToCells(source, shockAsset);
  // For treemap, use exposures tiles sized by abs(exposure)
  const tiles = (exposures ?? []).map((e: any) => ({
    name: e.target ?? e.sector ?? e.col ?? "unknown",
    value: Math.abs(e.exposure ?? e.weight ?? 0),
    exposure: e.exposure ?? e.weight ?? 0,
    rationale: e.rationale,
  }));

  // Also show candidate dashed edges if present
  const candidateCount = (matrix as any)?.candidate_edges?.length ?? 0;

  const heatmapDomain: [number, number] = exposures ? [-40, 40] : [-1, 1];

  return (
    <div className="terminal-page space-y-4 min-h-0 flex-1">
      <Breadcrumb section="Cross" ticker={shockAsset} />
      <h1 className="text-xl font-semibold">Cross-Market — {shockAsset} shock</h1>
      <div className="terminal-card p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="range"
            min={-40}
            max={40}
            step={1}
            value={shock}
            onChange={(e) => onShock(Number(e.target.value))}
            className="w-full max-w-[320px] h-1 bg-zinc-800 rounded accent-emerald-500"
          />
          <span className="font-mono tabular-nums text-[13px] min-w-[48px]">{shock > 0 ? "+" : ""}{shock}</span>
          {pending && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {(["BRENT","WTI","NATGAS"] as const).map((a) => (
            <button key={a} onClick={() => { setShockAsset(a); doSimulate(shock); }} className={`h-6 px-3 rounded-full border text-[11px] font-mono flex items-center ${a===shockAsset ? "bg-white text-zinc-950 border-white" : "border-zinc-800 text-zinc-500 hover:bg-zinc-800"}`}>{a}</button>
          ))}
          {candidateCount > 0 && <span className="text-xs text-amber-400 ml-2">{candidateCount} dashed SerpApi candidates [6,4]</span>}
          {exposedChokepoints.length > 0 && (
            <div className="flex gap-1 flex-wrap items-center">
              {exposedChokepoints.map((id) => (
                <a key={id} href={`/map?choke=${encodeURIComponent(id)}`} className="h-6 px-2 rounded-full bg-amber-500/10 border border-amber-600 text-amber-400 text-[11px] font-mono hover:bg-amber-500/20">{id}</a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="terminal-card p-4 overflow-hidden">
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400">
          Beta heatmap {exposures ? `(shock ${shock > 0 ? "+" : ""}${shock})` : "(curated weights)"}
        </div>
        {rows.length && cols.length ? (
          <div className={pending ? "animate-pulse opacity-90" : ""}>
            <HeatmapMatrix cells={cells} rows={rows} cols={cols} domain={heatmapDomain} onCellClick={(c) => doSimulate(shock)} />
          </div>
        ) : (
          <div className="text-sm text-zinc-500 mt-2">No heatmap data — move the shock slider or pick BRENT / WTI / NATGAS.</div>
        )}
      </div>

      <div className="terminal-card p-4">
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-zinc-400">Treemap Sectors — squarify 1.6 · size abs(exposure) · color sign</div>
        <div className="mt-3">
          <TreemapSectors tiles={tiles.length ? tiles : cells.slice(0,12).map(c=>({name:c.col, value:Math.abs(c.value), exposure:c.value, rationale:c.rationale}))} />
        </div>
      </div>

      {exposures && exposures.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {exposures.map((e: any, i: number) => (
            <div key={i} className="terminal-card p-3">
              <div className="text-sm font-medium">{e.target ?? e.sector ?? JSON.stringify(e).slice(0, 40)}</div>
              <div className="text-xs text-zinc-500 font-mono">{e.exposure != null ? `${e.exposure > 0 ? "+" : ""}${Number(e.exposure).toFixed(2)}` : e.weight ?? ""} {e.rationale ? `· ${e.rationale.slice(0,60)}` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

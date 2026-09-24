import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMapAll, fetchGeo, fetchMapLayer } from "@/api/client";
import { TTL_S } from "@/lib/ttls";
import { MapView } from "@/components/Map/MapView";
import { ChokepointPanel } from "@/components/Map/ChokepointPanel";
import { LayerToggles } from "@/components/Map/LayerToggles";
import { useState, useMemo } from "react";

function dotsFromLayer(data: any): any[] {
  const p = data?.payload ?? data;
  if (Array.isArray(p?.dots)) return p.dots;
  // disasters feed returns {dots: [], alerts: [{title, link}]} — pass alerts
  // through so the toggle badge counts them; DeckOverlay only plots geo dots.
  if (Array.isArray(p?.alerts)) return p.alerts;
  if (Array.isArray(p)) return p;
  return [];
}

export default function WorldMapPage() {
  const [params] = useSearchParams();
  const choke = params.get("choke") ?? params.get("chokepoint") ?? "hormuz";
  const { data } = useQuery({
    queryKey: ["map-all"],
    queryFn: fetchMapAll,
    staleTime: Infinity,
    gcTime: TTL_S["map:box"] * 1000,
    refetchInterval: TTL_S["map:box"] * 1000,
  });
  const boxes = (data as any)?.boxes ?? (Array.isArray(data) ? data : []);
  const activeBox = boxes.find((b: any) => b.id === choke) ?? boxes[0];
  // Unknown ?choke= falls back to the first box so WS/REST/bbox stay consistent.
  const activeId = activeBox?.id ?? choke;
  const [layers, setLayers] = useState<any[]>(["ais"]);

  const qPorts = useQuery({
    queryKey: ["geo", "ports"],
    queryFn: () => fetchGeo("ports"),
    staleTime: TTL_S["geo"] * 1000,
    enabled: layers.includes("ports"),
  });
  const qRoutes = useQuery({
    queryKey: ["geo", "routes"],
    queryFn: () => fetchGeo("routes"),
    staleTime: TTL_S["geo"] * 1000,
    enabled: layers.includes("routes"),
  });
  const qTss = useQuery({
    queryKey: ["geo", "tss_lanes"],
    queryFn: () => fetchGeo("tss_lanes"),
    staleTime: TTL_S["geo"] * 1000,
    enabled: layers.includes("tss") || layers.includes("tss_lanes"),
  });
  const qArcs = useQuery({
    queryKey: ["geo", "trade_arcs"],
    queryFn: () => fetchGeo("trade_arcs"),
    staleTime: TTL_S["geo"] * 1000,
    enabled: layers.includes("arcs") || layers.includes("trade_arcs"),
  });
  const geo = { ports: qPorts.data, routes: qRoutes.data, tss_lanes: qTss.data, trade_arcs: qArcs.data };

  const weatherQ = useQuery({
    queryKey: ["map-layer", "weather"],
    queryFn: () => fetchMapLayer("weather"),
    enabled: layers.includes("weather"),
    staleTime: Infinity,
  });
  const eqQ = useQuery({
    queryKey: ["map-layer", "earthquakes"],
    queryFn: () => fetchMapLayer("earthquakes"),
    enabled: layers.includes("earthquakes"),
    staleTime: Infinity,
  });
  const disQ = useQuery({
    queryKey: ["map-layer", "disasters"],
    queryFn: () => fetchMapLayer("disasters"),
    enabled: layers.includes("disasters"),
    staleTime: Infinity,
  });

  const layerDots = useMemo(
    () => ({
      weather: dotsFromLayer(weatherQ.data),
      earthquakes: dotsFromLayer(eqQ.data),
      disasters: dotsFromLayer(disQ.data),
    }),
    [weatherQ.data, eqQ.data, disQ.data],
  );

  return (
    <div className="w-full h-[calc(100dvh-52px)] flex flex-col overflow-hidden bg-canvas">
      <div className="h-11 px-3 lg:px-5 flex items-center gap-2 bg-panel/95 border-b border-border-subtle shrink-0 overflow-x-auto backdrop-blur-sm">
        {boxes.map((b: any) => (
          <a
            key={b.id}
            href={`/map?choke=${b.id}`}
            className={`h-7 px-3 rounded-pill border text-xs font-medium whitespace-nowrap ${
              b.id === activeId ? "bg-voltage text-voltage-foreground border-voltage" : "bg-panel border-border-subtle text-ink-muted"
            }`}
          >
            {b.name ?? b.id}{" "}
            {b.pct_change != null ? `${b.pct_change > 0 ? "+" : ""}${b.pct_change.toFixed(1)}%` : ""}
            {b.stale ? " · STALE" : ""}
          </a>
        ))}
      </div>
      <div className="flex-1 relative min-h-0 w-full">
        <MapView chokepointId={activeId} bbox={activeBox?.bbox} visible={layers} geo={geo} layerDots={layerDots} />
        {activeBox && (
          <div className="absolute right-0 top-0 bottom-0 w-[min(380px,30vw)] max-w-[85vw] bg-panel/90 border-l border-border-subtle overflow-y-auto hidden lg:block z-10 backdrop-blur-md shadow-[-8px_0_24px_rgba(0,0,0,0.35)]">
            <ChokepointPanel box={activeBox} />
          </div>
        )}
        {activeBox && (
          <div className="absolute bottom-0 left-0 right-0 max-h-[45vh] bg-panel border-t border-border-subtle rounded-t-xl overflow-auto lg:hidden z-10">
            <ChokepointPanel box={activeBox} />
          </div>
        )}
        <div className="absolute bottom-6 right-[calc(min(380px,30vw)+1rem)] z-20 hidden lg:block">
          <LayerToggles
            visible={layers}
            onChange={setLayers}
            layerCounts={layerDots}
            geoEmpty={{
              ports: layers.includes("ports") && !qPorts.data?.features?.length,
              routes: layers.includes("routes") && !qRoutes.data?.features?.length,
            }}
          />
        </div>
        <div className="absolute top-3 left-3 z-20 lg:hidden">
          <LayerToggles visible={layers} onChange={setLayers} layerCounts={layerDots} />
        </div>
      </div>
    </div>
  );
}

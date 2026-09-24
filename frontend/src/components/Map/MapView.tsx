import { useCallback, useEffect, useRef, useState } from "react";
import { DeckOverlay } from "./DeckOverlay";
import Map, { NavigationControl, AttributionControl, type MapRef } from "react-map-gl/maplibre";
import { useMapWS } from "@/api/useMapWS";
import { useQuery } from "@tanstack/react-query";
import { fetchMapBox } from "@/api/client";
import type { StyleSpecification } from "maplibre-gl";
import { MAP_STYLE_FALLBACKS } from "@/lib/mapBasemap";

export type LayerDots = { weather?: any[]; earthquakes?: any[]; disasters?: any[] };

function centerFromBbox(bbox?: [[number, number], [number, number]]) {
  if (!bbox) return { longitude: 56.3, latitude: 26.5, zoom: 5.2 };
  const lon = (bbox[0][1] + bbox[1][1]) / 2;
  const lat = (bbox[0][0] + bbox[1][0]) / 2;
  return { longitude: lon, latitude: lat, zoom: 5.4 };
}

/** bbox from API: [[lat, lon], [lat, lon]] → MapLibre LngLatBounds */
function boundsFromBbox(bbox: [[number, number], [number, number]]): [[number, number], [number, number]] {
  return [[bbox[0][1], bbox[0][0]], [bbox[1][1], bbox[1][0]]];
}

export function MapView({
  chokepointId = "hormuz",
  bbox,
  visible = ["ais"],
  geo,
  layerDots,
}: {
  chokepointId?: string;
  bbox?: [[number, number], [number, number]];
  visible?: string[];
  geo?: { ports?: any; routes?: any; tss_lanes?: any; trade_arcs?: any };
  layerDots?: LayerDots;
}) {
  const mapRef = useRef<MapRef>(null);
  const [styleIndex, setStyleIndex] = useState(0);
  const [styleError, setStyleError] = useState<string | null>(null);
  const mapStyle: StyleSpecification = MAP_STYLE_FALLBACKS[Math.min(styleIndex, MAP_STYLE_FALLBACKS.length - 1)];

  const [viewState, setViewState] = useState(() => ({
    ...centerFromBbox(bbox),
    pitch: 0,
    bearing: 0,
  }));

  useEffect(() => {
    const c = centerFromBbox(bbox);
    setViewState((v) => ({ ...v, ...c }));
  }, [bbox, chokepointId]);

  const fitChokeBounds = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !bbox) return;
    try {
      map.fitBounds(boundsFromBbox(bbox), { padding: { top: 56, bottom: 88, left: 48, right: 420 }, duration: 600, maxZoom: 9 });
    } catch {
      /* ignore */
    }
  }, [bbox]);

  useEffect(() => {
    fitChokeBounds();
  }, [fitChokeBounds, chokepointId, styleIndex]);

  const ws = useMapWS(chokepointId);
  const rest = useQuery({
    queryKey: ["map", chokepointId],
    queryFn: () => fetchMapBox(chokepointId),
    enabled: true,
    staleTime: Infinity,
    gcTime: 30_000,
    refetchInterval: ws.status === "dead" ? 30_000 : false,
  });
  const vessels =
    ws.vessels ??
    (Array.isArray(rest.data?.positions) ? new Map(rest.data.positions.map((p: any) => [p.mmsi, p])) : null);
  const vesselCount = vessels?.size ?? rest.data?.count ?? ws.meta?.count ?? 0;

  const onMapError = useCallback(
    (e: { error?: Error }) => {
      const msg = e.error?.message ?? "Basemap failed to load";
      if (styleIndex < MAP_STYLE_FALLBACKS.length - 1) {
        setStyleIndex((i) => i + 1);
        setStyleError(null);
        return;
      }
      setStyleError(msg);
    },
    [styleIndex],
  );

  return (
    <div className="terminal-map absolute inset-0">
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        longitude={viewState.longitude}
        latitude={viewState.latitude}
        zoom={viewState.zoom}
        pitch={viewState.pitch}
        bearing={viewState.bearing}
        onMove={(e) => setViewState(e.viewState)}
        onLoad={fitChokeBounds}
        onError={onMapError}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
        maxPitch={52}
      >
        <NavigationControl position="bottom-left" showCompass />
        <AttributionControl position="bottom-right" compact />
        <DeckOverlay
          vessels={vessels}
          viewState={viewState}
          showTrails={visible.includes("trails")}
          showArcs={visible.includes("arcs") || visible.includes("trade_arcs")}
          arcs={geo?.trade_arcs?.arcs ?? []}
          geo={geo}
          visible={visible}
          layerDots={layerDots}
        />
      </Map>
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[min(320px,70vw)]">
        <div className="bg-panel/92 border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono text-ink shadow-lg backdrop-blur-md">
          <span className="text-ink-muted">AIS</span>{" "}
          <span className={ws.status === "live" ? "text-success" : "text-warning"}>{ws.status}</span>
          <span className="text-ink-dim"> · </span>
          <span className="tabular-nums">{vesselCount}</span> vessels
          {rest.data?.stale || ws.meta?.stale ? <span className="text-warning"> · seed</span> : null}
        </div>
        {ws.status === "dead" && (
          <div className="bg-warning-dim border border-warning-border rounded-md px-3 py-1.5 text-xs text-warning backdrop-blur-md">
            Live AIS unavailable — REST snapshot
          </div>
        )}
        {styleError && (
          <div className="bg-danger-dim border border-danger-border rounded-md px-3 py-1.5 text-xs text-danger backdrop-blur-md">
            Map tiles: {styleError}
          </div>
        )}
      </div>
    </div>
  );
}

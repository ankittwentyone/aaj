// src/components/Map/DeckOverlay.tsx — ONLY deck.gl import in codebase
import { useEffect, useState } from "react";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { ScatterplotLayer, PathLayer, ArcLayer, TextLayer } from "@deck.gl/layers";
// TripsLayer moved to @deck.gl/geo-layers in v9 — use PathLayer fallback if trails needed (keeps ONE deck import, no extra chunk)
// Keep MAX 3 MAP LAYERS note — trails is optional 4th but gated by zoom>=6 and showTrails flag, not counted in LayerToggles cap
import { DataFilterExtension } from "@deck.gl/extensions";
import { useControl } from "react-map-gl/maplibre";
import { setHighlight, subscribeHighlight, getHighlight } from "@/lib/linkedHighlight";

type GeoPayload = {
  ports?: any;
  routes?: any;
  tss_lanes?: any;
  trade_arcs?: any;
};

type FeedDots = { weather?: any[]; earthquakes?: any[]; disasters?: any[] };

export function DeckOverlay({
  vessels,
  showTrails,
  showArcs,
  viewState,
  arcs,
  geo,
  visible = ["ais"],
  layerDots,
}: {
  vessels?: Map<string, any> | null;
  showTrails?: boolean;
  showArcs?: boolean;
  viewState?: any;
  arcs?: any[];
  geo?: GeoPayload;
  visible?: string[];
  layerDots?: FeedDots;
}) {
  // interleaved:false — basemap raster stays visible; deck draws dots on top (not a black GL wipe)
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay({ interleaved: false, layers: [] }));
  const [hl, setHl] = useState(getHighlight());
  useEffect(() => subscribeHighlight(() => setHl(getHighlight())), []);
  useEffect(() => {
    const allVessels = vessels ? Array.from(vessels.values()) : [];
    const zoom = viewState?.zoom ?? 5;
    const maxDots = zoom < 5 ? 250 : zoom < 7 ? 900 : 1500;
    const data = allVessels.length > maxDots ? allVessels.filter((_, i) => i % Math.ceil(allVessels.length / maxDots) === 0).slice(0, maxDots) : allVessels;
    // MAX 3 MAP LAYERS visible at once — LayerToggles enforces, DeckOverlay is pure renderer

    // Geo helpers
    const portsFc = geo?.ports;
    const portsFeatures: any[] = Array.isArray(portsFc?.features) ? portsFc.features : [];
    const routesFc = geo?.routes;
    const routesFeatures: any[] = Array.isArray(routesFc?.features) ? routesFc.features : [];
    const tssFc = geo?.tss_lanes;
    const tssFeatures: any[] = Array.isArray(tssFc?.features) ? tssFc.features : [];
    const arcsRaw: any[] = geo?.trade_arcs?.arcs ?? arcs ?? [];
    // Show flags — visible controls MAX 3 MAP LAYERS; fall back to legacy booleans for compat
    const showPorts = visible.includes("ports");
    const showRoutes = visible.includes("routes");
    const showTss = visible.includes("tss") || visible.includes("tss_lanes");
    const showTradeArcs = visible.includes("arcs") || visible.includes("trade_arcs") || showArcs;

    const layers: any[] = [
      // Vessel dots — always via ais unless explicitly hidden
      ...(visible.includes("ais") || visible.length === 0
        ? [
            new ScatterplotLayer({
              id: "vessels",
              data,
              getPosition: (d: any) => [d.lon, d.lat],
              getRadius: 4,
              radiusMinPixels: 4,
              radiusMaxPixels: 4,
              radiusUnits: "pixels" as const,
              stroked: true,
              getLineWidth: 1,
              lineWidthMinPixels: 1,
              getLineColor: [255, 255, 255, 102],
              getFillColor: (d: any) => {
                const isHl = hl?.mmsi === d.mmsi || (hl?.owner && d.owner === hl.owner) || (hl?.commodity && (d.commodity === hl.commodity || d.cargo === hl.commodity || d.type === hl.commodity));
                if (isHl) return [255, 255, 255, 230];
                return d.type === "tanker" ? [245, 158, 11, 220] : d.type === "cargo" ? [59, 130, 246, 200] : d.type === "container" ? [16, 185, 129, 200] : d.type === "lng" ? [168, 85, 247, 210] : [113, 113, 122, 160];
              },
              pickable: true,
              onClick: (info: any) => {
                if (info.object) setHighlight({ mmsi: info.object.mmsi, owner: info.object.owner, commodity: info.object.commodity ?? info.object.cargo ?? info.object.type, chokepointId: info.object.chokepointId });
              },
              extensions: [new DataFilterExtension({ filterSize: 1 })],
              getFilterValue: () => 1,
              filterRange: [1, 1] as [number, number],
            }),
          ]
        : []),
      ...(zoom >= 8
        ? [
            new PathLayer({
              id: "headings",
              data: data.filter((d: any) => d.sog > 0.5).filter((_, i) => i % 6 === 0).slice(0, 200),
        getPath: (d: any) => {
          const len = d.sog * 0.0003;
          const rad = ((d.cog ?? 0) * Math.PI) / 180;
          return [
            [d.lon, d.lat],
            [d.lon + len * Math.sin(rad), d.lat + len * Math.cos(rad)],
          ];
        },
        getColor: [255, 255, 255, 180],
        getWidth: 1,
        widthUnits: "pixels" as const,
            }),
          ]
        : []),
      ...(showTrails && viewState?.zoom >= 6
        ? [
            // Fallback PathLayer for trails — TripsLayer moved out of @deck.gl/layers in v9.14; PathLayer keeps animation-free trail visible without extra chunk
            new PathLayer({
              id: "trails",
              data: data.filter((d: any) => d.trail && d.trail.length > 1),
              getPath: (d: any) => d.trail.map(([lat, lon]: [number, number]) => [lon, lat]),
              getColor: (d: any) => (d.type === "tanker" ? [255, 56, 96, 140] : [0, 230, 118, 140]),
              getWidth: 2,
              widthUnits: "pixels" as const,
              opacity: 0.6,
            } as any),
          ]
        : []),
      // ── GEO: ports as Scatter + Text (only when visible + zoom >= 4 to avoid clutter) ──
      ...(showPorts && portsFeatures.length
        ? [
            new ScatterplotLayer({
              id: "ports",
              data: portsFeatures,
              getPosition: (d: any) => d.geometry?.coordinates ?? [0, 0],
              getRadius: 3,
              radiusUnits: "pixels" as const,
              getFillColor: [161, 161, 170, 200],
              getLineColor: [35, 35, 39, 255],
              stroked: true,
              lineWidthMinPixels: 1,
              pickable: true,
            }),
            new TextLayer({
              id: "ports-labels",
              data: viewState?.zoom >= 5 ? portsFeatures.slice(0, 120) : [],
              getPosition: (d: any) => d.geometry?.coordinates ?? [0, 0],
              getText: (d: any) => d.properties?.name ?? "",
              getSize: 10,
              sizeUnits: "pixels" as const,
              getColor: [161, 161, 170, 180],
              getAngle: 0,
              getTextAnchor: "middle" as const,
              getAlignmentBaseline: "top" as const,
              getPixelOffset: [0, 8] as any,
              background: false,
              pickable: false,
            } as any),
          ]
        : []),
      // ── GEO: routes dim GeoJsonLine (PathLayer muted) ──
      ...(showRoutes && routesFeatures.length
        ? [
            new PathLayer({
              id: "routes",
              data: routesFeatures,
              getPath: (d: any) => d.geometry?.coordinates ?? [],
              getColor: [82, 82, 91, 110],
              getWidth: 1,
              widthUnits: "pixels" as const,
              pickable: false,
              opacity: 0.55,
            }),
          ]
        : []),
      // ── GEO: tss_lanes dashed [6,4] ──
      ...(showTss && tssFeatures.length
        ? [
            new PathLayer({
              id: "tss_lanes",
              data: tssFeatures,
              getPath: (d: any) => d.geometry?.coordinates ?? [],
              getColor: [82, 82, 91, 160],
              getWidth: 1,
              widthUnits: "pixels" as const,
              getDashArray: [6, 6],
              dashJustified: true,
              pickable: false,
              opacity: 0.9,
            }),
          ]
        : []),
      // ── GEO: trade_arcs ArcLayer with getWidth sqrt(volume) ──
      ...(visible.includes("weather") && (layerDots?.weather?.length ?? 0) > 0
        ? [
            new ScatterplotLayer({
              id: "weather-dots",
              data: layerDots!.weather!.filter((d) => d.lat != null && d.lon != null),
              getPosition: (d: any) => [d.lon, d.lat],
              getRadius: 6,
              radiusUnits: "pixels" as const,
              getFillColor: [96, 165, 250, 200],
              stroked: false,
              pickable: true,
            }),
          ]
        : []),
      ...(visible.includes("earthquakes") && (layerDots?.earthquakes?.length ?? 0) > 0
        ? [
            new ScatterplotLayer({
              id: "eq-dots",
              data: layerDots!.earthquakes!,
              getPosition: (d: any) => [d.lon, d.lat],
              getRadius: (d: any) => Math.min(14, 4 + (d.mag ?? 4) * 1.5),
              radiusUnits: "pixels" as const,
              getFillColor: [245, 158, 11, 220],
              stroked: true,
              getLineColor: [255, 255, 255, 120],
              lineWidthMinPixels: 1,
              pickable: true,
            }),
          ]
        : []),
      // disasters feed is mostly {alerts:[{title,link}]} with no lat/lon —
      // plot the geo-capable subset only, never crash on title-only alerts.
      ...(visible.includes("disasters") && (layerDots?.disasters?.length ?? 0) > 0
        ? [
            new ScatterplotLayer({
              id: "disaster-dots",
              data: layerDots!.disasters!.filter((d) => d.lat != null && d.lon != null),
              getPosition: (d: any) => [d.lon, d.lat],
              getRadius: 7,
              radiusUnits: "pixels" as const,
              getFillColor: [239, 68, 68, 220],
              stroked: true,
              getLineColor: [255, 255, 255, 120],
              lineWidthMinPixels: 1,
              pickable: true,
            }),
          ]
        : []),
      ...(showTradeArcs && arcsRaw.length
        ? [
            new ArcLayer({
              id: "trade_arcs",
              data: arcsRaw,
              // backend trade_arcs: {from:[lat,lon], to:[lat,lon], volume_bpd?, volume?, commodity} — normalize to [lon,lat]
              getSourcePosition: (d: any) => {
                const f = d.from ?? d.source ?? d.src;
                if (!Array.isArray(f)) return [0, 0];
                // stored as [lat, lon] per curated/trade_arcs.json — swap to [lon, lat] for deck
                return f.length === 2 && Math.abs(f[0]) <= 90 && Math.abs(f[1]) <= 180 && Math.abs(f[0]) < 90 ? [f[1], f[0]] : f;
              },
              getTargetPosition: (d: any) => {
                const t = d.to ?? d.target ?? d.dst;
                if (!Array.isArray(t)) return [0, 0];
                return t.length === 2 && Math.abs(t[0]) <= 90 && Math.abs(t[1]) <= 180 && Math.abs(t[0]) < 90 ? [t[1], t[0]] : t;
              },
              getSourceColor: [0, 176, 255, 120],
              getTargetColor: [255, 179, 0, 120],
              // sqrt(volume) scaling — fallback to 2 if no volume field
              getWidth: (d: any) => {
                const v = d.volume_bpd ?? d.volume ?? d.value ?? 0;
                if (!v || typeof v !== "number") return 2;
                return Math.max(1, Math.min(8, Math.sqrt(v / 50000)));
              },
              greatCircle: true,
              numSegments: 24,
              pickable: true,
            }),
          ]
        : []),
    ];

    const id = window.setTimeout(() => overlay.setProps({ layers }), 120);
    return () => window.clearTimeout(id);
  }, [vessels, showTrails, showArcs, viewState, overlay, arcs, geo, visible, hl, layerDots]);
  return null;
}

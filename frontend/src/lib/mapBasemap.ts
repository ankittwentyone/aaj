import type { StyleSpecification } from "maplibre-gl";

/**
 * Bundled basemap — no external style.json fetch (avoids 404/wrong slug/CORS).
 * Carto raster `dark_all`: gray land + muted labels on charcoal water — reads on #09090B chrome.
 */
export const TERMINAL_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "AAJ Terminal",
  sources: {
    cartoDark: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© CARTO © OpenStreetMap",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#2a2a32" },
    },
    {
      id: "carto-raster",
      type: "raster",
      source: "cartoDark",
      minzoom: 0,
      maxzoom: 20,
      paint: {
        "raster-opacity": 1,
        "raster-contrast": 0.25,
        "raster-brightness-min": 0.05,
        "raster-brightness-max": 0.92,
      },
    },
  ],
};

/** Lighter fallback if Carto raster is blocked — still visible on black UI */
export const TERMINAL_MAP_STYLE_LIGHT: StyleSpecification = {
  version: 8,
  name: "AAJ Terminal Light",
  sources: {
    cartoLight: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© CARTO © OpenStreetMap",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#3f3f46" } },
    { id: "voyager", type: "raster", source: "cartoLight", paint: { "raster-opacity": 0.88 } },
  ],
};

export const MAP_STYLE_FALLBACKS: StyleSpecification[] = [TERMINAL_MAP_STYLE, TERMINAL_MAP_STYLE_LIGHT];

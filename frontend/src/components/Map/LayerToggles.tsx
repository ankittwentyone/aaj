import { assertMapLayers } from "@/lib/guardrails";
import { useQuery } from "@tanstack/react-query";
import { fetchMapLayer } from "@/api/client";
import { TTL_S } from "@/lib/ttls";
import { useState } from "react";

type LayerId = "ais" | "trails" | "tss" | "ports" | "routes" | "arcs" | "weather" | "earthquakes" | "disasters";

const LAYER_META: Record<LayerId, { label: string; hint: string }> = {
  ais: { label: "AIS", hint: "Live vessel positions" },
  trails: { label: "Trails", hint: "Vessel track history" },
  tss: { label: "TSS", hint: "Traffic separation schemes" },
  ports: { label: "Ports", hint: "Major port markers" },
  routes: { label: "Routes", hint: "Shipping lane lines" },
  arcs: { label: "Trade arcs", hint: "Commodity flow arcs" },
  weather: { label: "Weather", hint: "Weather alert dots" },
  earthquakes: { label: "Quakes", hint: "USGS earthquake feed" },
  disasters: { label: "Disasters", hint: "GDACS-style alerts" },
};

const PRESETS: Record<string, LayerId[]> = {
  Minimal: ["ais"],
  Shipping: ["ais", "tss", "arcs"],
  Hazards: ["ais", "earthquakes", "weather"],
};

export function LayerToggles({
  visible,
  onChange,
  layerCounts,
  geoEmpty,
}: {
  visible: LayerId[];
  onChange: (next: LayerId[]) => void;
  layerCounts?: { weather?: any[]; earthquakes?: any[]; disasters?: any[] };
  geoEmpty?: { ports?: boolean; routes?: boolean };
}) {
  const [hint, setHint] = useState("");

  function apply(next: LayerId[]) {
    const capped = next.includes("ais") ? next : ["ais", ...next];
    let trimmed = capped;
    if (trimmed.length > 3) {
      const opt = trimmed.filter((v) => v !== "ais");
      trimmed = ["ais", ...opt.slice(-2)] as LayerId[];
      setHint("Max 3 overlays — turned off oldest layer.");
    } else setHint("");
    try {
      assertMapLayers(trimmed);
    } catch {
      return;
    }
    onChange(trimmed);
  }

  function toggle(id: LayerId) {
    const next = visible.includes(id) ? visible.filter((v) => v !== id) : [...visible, id];
    apply(next);
  }

  const all: LayerId[] = ["ais", "tss", "arcs", "ports", "routes", "weather", "earthquakes", "disasters"];

  const weatherQ = useQuery({
    queryKey: ["map-layer", "weather"],
    queryFn: () => fetchMapLayer("weather"),
    enabled: visible.includes("weather") && !layerCounts,
    staleTime: Infinity,
    gcTime: TTL_S.geo * 1000,
  });
  const eqQ = useQuery({
    queryKey: ["map-layer", "earthquakes"],
    queryFn: () => fetchMapLayer("earthquakes"),
    enabled: visible.includes("earthquakes") && !layerCounts,
    staleTime: Infinity,
    gcTime: TTL_S.geo * 1000,
  });
  const disQ = useQuery({
    queryKey: ["map-layer", "disasters"],
    queryFn: () => fetchMapLayer("disasters"),
    enabled: visible.includes("disasters") && !layerCounts,
    staleTime: Infinity,
    gcTime: TTL_S.geo * 1000,
  });

  const dotLen = (data: any) => {
    const p = data?.payload ?? data;
    return p?.dots?.length ?? p?.alerts?.length ?? 0;
  };

  const counts: Record<string, number> = {
    weather: layerCounts?.weather?.length ?? dotLen(weatherQ.data),
    earthquakes: layerCounts?.earthquakes?.length ?? dotLen(eqQ.data),
    disasters: layerCounts?.disasters?.length ?? dotLen(disQ.data),
  };

  return (
    <div className="terminal-panel p-2 max-w-[min(100vw-2rem,520px)]">
      <div className="flex gap-1 flex-wrap mb-2">
        {Object.entries(PRESETS).map(([name, layers]) => (
          <button
            key={name}
            type="button"
            onClick={() => apply(layers)}
            className={`h-7 px-2.5 rounded-md border text-[10px] font-mono transition-colors ${
              visible.join(",") === layers.join(",") ? "bg-hover border-voltage-border text-ink" : "border-border-subtle text-ink-muted hover:bg-hover"
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap items-center">
        {all.map((id) => {
          const isActive = visible.includes(id);
          const isFeeds = ["weather", "earthquakes", "disasters"].includes(id);
          const cnt = counts[id] ?? 0;
          const emptyGeo = (id === "ports" && geoEmpty?.ports) || (id === "routes" && geoEmpty?.routes);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`h-7 px-2.5 rounded-pill border text-[10px] font-medium flex items-center gap-1 ${
                isActive ? "bg-voltage text-voltage-foreground border-voltage" : "bg-panel border-border-subtle text-ink-muted"
              }`}
              title={emptyGeo ? "Layer data unavailable" : LAYER_META[id].hint}
              aria-pressed={isActive}
            >
              {LAYER_META[id].label}
              {emptyGeo && isActive && <span className="opacity-70">∅</span>}
              {isFeeds && isActive && cnt > 0 && <span className="bg-white/20 rounded-pill px-1 font-mono">{cnt}</span>}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-ink-dim mt-1.5">AIS always on · max 3 overlays</div>
      {hint && <div className="text-[10px] text-warning mt-1">{hint}</div>}
    </div>
  );
}

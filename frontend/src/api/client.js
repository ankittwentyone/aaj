import { QueryClient } from "@tanstack/react-query";
import { TTL_S } from "@/lib/ttls";

export const WS_BASE = import.meta.env.VITE_API_BASE ?? "";
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: TTL_S["market-home"] * 1000,
      retry: (count, err) => {
        if (err?.status === 429) return count < 1;
        return count < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

async function fetchJSON(path, opts) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, { credentials: "omit", ...opts });
  if (!res.ok) throw Object.assign(new Error(`fetch ${path} ${res.status}`), { status: res.status });
  return res.json();
}

export const fetchHome = () => fetchJSON("/api/market-home");
export const fetchAsset = (ticker) => fetchJSON(`/api/asset/${encodeURIComponent(ticker)}`);
export const fetchEvents = (q = "oil markets geopolitics", num = 20) =>
  fetchJSON(`/api/events?q=${encodeURIComponent(q)}&num=${num}`);
export const fetchEventChain = (id) => fetchJSON(`/api/events/${encodeURIComponent(id)}/chain`);
export const fetchCrossMarket = () => fetchJSON("/api/cross-market");
export const fetchSimulate = (shock_asset, shock_value) =>
  fetchJSON("/api/cross-market/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shock_asset, shock_value }),
  });
export const fetchMapAll = () => fetchJSON("/api/map");
export const fetchMapBox = (id) => fetchJSON(`/api/map/${encodeURIComponent(id)}`);
export const fetchMapHistory = (id, hours = 720) =>
  fetchJSON(`/api/map/${encodeURIComponent(id)}/history?hours=${hours}`);
export const fetchGeo = (layer) => fetchJSON(`/api/geo/${encodeURIComponent(layer)}`);
export const fetchMapLayer = (feed) => fetchJSON(`/api/map/layers/${encodeURIComponent(feed)}`);
export const fetchSearch = (q, limit = 8) =>
  fetchJSON(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`);
export const fetchHealthz = () => fetchJSON("/healthz");
export const fetchReadyz = () => fetchJSON("/readyz");
export const postResearchRun = (query) =>
  fetchJSON("/api/research/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

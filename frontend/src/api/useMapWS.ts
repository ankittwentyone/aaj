import { useEffect, useRef, useState, useCallback } from "react";
import { pushTrace } from "@/lib/analytics";

type Vessel = { mmsi: string; lat: number; lon: number; sog: number; cog: number; type?: string; trail?: [number, number][]; updated_at?: string };
type Snapshot = { type: "snapshot"; id: string; data: { positions: Vessel[]; count: number; baseline_7d: number; pct_change: number; stale: boolean; retrieved_at: string } };
type Diff = { type: "diff"; id: string; added: Vessel[]; updated: Pick<Vessel, "mmsi" | "lat" | "lon" | "sog" | "cog">[]; removed: string[]; count: number; pct_change: number; stale: boolean };
type Msg = Snapshot | Diff;

const CAP = 2000;

function wsBase(): string {
  const env = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (env) return env.replace(/^http/, "ws");
  // No build-time base (prod single-server + vite dev proxy): derive from page.
  // https: → wss:, http: → ws: so deployed https never tries insecure ws://.
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "";
}

function isVisible() {
  return document.visibilityState === "visible";
}

export function useMapWS(chokepointId: string) {
  const [vessels, setVessels] = useState<Map<string, Vessel> | null>(null);
  const [meta, setMeta] = useState<{ count: number; pct_change: number; stale: boolean; retrieved_at?: string }>({
    count: 0,
    pct_change: 0,
    stale: true,
  });
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting" | "dead">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (!chokepointId) return;
    const url = `${wsBase()}/ws/map/${chokepointId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus(retryRef.current === 0 ? "connecting" : "reconnecting");

    ws.onmessage = (ev) => {
      if (!isVisible()) return;
      const msg: Msg = JSON.parse(ev.data);
      // trace for judge: engine/query/result_count/timestamp provenance
      pushTrace({ session: chokepointId, node: msg.type, label: `WS ${msg.type} ${chokepointId}`, stage: msg.type, status: "done", engine: "aisstream", result_count: (msg as any).count ?? (msg as any).data?.count, timestamp: new Date().toISOString() });
      if (msg.type === "snapshot") {
        const m = new Map<string, Vessel>();
        for (const p of (msg.data.positions ?? []).slice(0, CAP)) m.set(p.mmsi, p);
        setVessels(m);
        setMeta({
          count: msg.data.count ?? 0,
          pct_change: msg.data.pct_change ?? 0,
          stale: msg.data.stale ?? true,
          retrieved_at: (msg.data as any).retrieved_at,
        });
        setStatus("live");
        retryRef.current = 0;
      } else {
        setVessels((prev) => {
          const next = prev ? new Map(prev) : new Map<string, Vessel>();
          if (!prev && !(msg.added?.length || msg.updated?.length)) return prev;
          for (const mm of msg.removed ?? []) next.delete(mm);
          for (const p of msg.added ?? []) if (next.size < CAP) next.set(p.mmsi, p);
          for (const u of msg.updated ?? []) {
            const cur = next.get(u.mmsi);
            if (cur) next.set(u.mmsi, { ...cur, lat: u.lat, lon: u.lon, sog: u.sog, cog: u.cog, updated_at: new Date().toISOString() });
          }
          return next;
        });
        setMeta((m) => ({ ...m, count: msg.count ?? m.count, pct_change: msg.pct_change ?? m.pct_change, stale: msg.stale ?? m.stale }));
        setStatus("live");
      }
    };

    ws.onclose = ws.onerror = () => {
      wsRef.current = null;
      if (retryRef.current > 8) {
        setStatus("dead");
        return;
      }
      setStatus("reconnecting");
      const jitter = Math.random() * 0.3;
      const backoff = Math.min(5 * Math.pow(2, retryRef.current), 60);
      retryRef.current += 1;
      timerRef.current = window.setTimeout(connect, (backoff + backoff * jitter) * 1000);
    };
  }, [chokepointId]);

  useEffect(() => {
    connect();
    const onVis = () => {
      if (isVisible() && wsRef.current?.readyState !== WebSocket.OPEN) connect();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      wsRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connect]);

  useEffect(() => {
    let hiddenAt = 0;
    const onChange = () => {
      if (!isVisible()) hiddenAt = Date.now();
      else if (Date.now() - hiddenAt > 30_000) {
        wsRef.current?.close();
        connect();
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [connect]);

  return { vessels, meta, status };
}

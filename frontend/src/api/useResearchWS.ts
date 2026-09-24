import { useEffect, useRef, useState, useCallback } from "react";
import { pushTrace } from "@/lib/analytics";
import { postResearchRun } from "./client";

export type TraceEvent = {
  session: string;
  node: string;
  label: string;
  stage: string;
  status: "running" | "done" | "skipped";
  query?: string;
  engine?: string;
  result_count?: number;
  timestamp: string;
  duration_ms?: number;
  error?: string;
  reason?: string;
};

function isVisible() { return document.visibilityState === "visible"; }

// ONE agent workspace — jittered thinking, via SerpApi vs via SEC distinction
// base 140 +/-80 + per-engine variance (news 160±30, trends 220±50, search 180±40)
export function jitter(engine?: string): number {
  const base = 140 + (Math.random() * 160 - 80); // 60..220
  if (engine === "google_news") return base + 20 + (Math.random() * 60 - 30);
  if (engine === "google_trends") return base + 80 + (Math.random() * 100 - 50);
  if (engine === "google_search") return base + 40 + (Math.random() * 80 - 40);
  return base;
}

export function useResearchWS(sessionId: string, query: string, onFinal?: (report: string, evidence_count: number) => void) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [final, setFinal] = useState<{ report: string; evidence_count: number; evidence?: any[] } | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "streaming" | "done" | "error">("idle");
  const eventsRef = useRef<TraceEvent[]>([]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const fallbackTried = useRef(false);

  const connect = useCallback(() => {
    if (!query) return;
    if (!isVisible()) {
      // visibility pause — do not spin WS while tab hidden
      setStatus("connecting");
      return;
    }
    setStatus(retryRef.current === 0 ? "connecting" : "streaming");
    const env = import.meta.env.VITE_API_BASE as string | undefined;
    let wsBase = "";
    if (env) wsBase = env.replace(/^http/, "ws");
    else if (typeof window !== "undefined") {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsBase = `${proto}//${window.location.host}`;
    }
    const ws = new WebSocket(`${wsBase}/ws/research/${sessionId}`);
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ query }));
      setStatus("streaming");
      retryRef.current = 0;
    };
    ws.onmessage = (ev) => {
      if (!isVisible()) return;
      const msg = JSON.parse(ev.data);
      if (msg.final) {
        let evidence: any[] = [];
        if (msg.evidence && Array.isArray(msg.evidence)) evidence = msg.evidence;
        else if (msg.evidence_count > 0) {
          evidence = eventsRef.current
            .filter((e) => e.result_count !== undefined)
            .map((e) => ({ provider: "serpapi", dataset: e.engine ?? e.stage, query: e.query, retrieved_at: e.timestamp, engine: e.engine }));
        }
        // wire analytics __AAJ_TRACE
        try { evidence.forEach((e: any) => pushTrace({ session: sessionId, node: e.dataset ?? "evidence", label: e.query ?? "", stage: e.dataset ?? "", status: "done", timestamp: e.retrieved_at ?? new Date().toISOString() } as any)); } catch {}
        setFinal({ report: msg.report, evidence_count: msg.evidence_count ?? evidence.length, evidence });
        setStatus("done");
        onFinal?.(msg.report, msg.evidence_count ?? 0);
        // push final trace
        try { pushTrace({ session: sessionId, node: "synthesize", label: "report", stage: "synthesize", status: "done", timestamp: new Date().toISOString() } as any); } catch {}
        ws.close();
        return;
      }
      if (msg.stage || msg.node) {
        // 100% real wiring — use backend trace verbatim, no jitter synthesis
        const realDuration =
          msg.duration_ms ??
          (msg.started_at && msg.finished_at
            ? Math.max(0, new Date(msg.finished_at).getTime() - new Date(msg.started_at).getTime())
            : undefined);
        const enriched = { ...msg, duration_ms: realDuration } as TraceEvent;
        setEvents((prev) => [...prev, enriched]);
        try { pushTrace(enriched); } catch {}
      }
      if (msg.error) setStatus("error");
    };
    ws.onerror = ws.onclose = () => {
      wsRef.current = null;
      if (status === "done") return;
      // exponential backoff + jitter, visibility pause
      if (retryRef.current > 5) {
        // fallback to POST /api/research/run after WS retries exhausted
        if (!fallbackTried.current) {
          fallbackTried.current = true;
          setStatus("connecting");
          postResearchRun(query).then((res: any) => {
            const evidence = res.evidence ?? [];
            const trace: any[] = res.trace ?? [];
            setFinal({ report: res.report ?? res.markdown ?? "", evidence_count: res.evidence_count ?? evidence.length, evidence });
            setStatus("done");
            onFinal?.(res.report ?? "", res.evidence_count ?? 0);
            // 100% real wiring — no pseudo synthesis. Use backend trace verbatim if present.
            if (trace.length) {
              setEvents(
                trace.map(
                  (t: any) =>
                    ({
                      session: sessionId,
                      node: t.stage ?? t.node ?? "web_search",
                      label: t.query ?? t.stage ?? t.node ?? "",
                      stage: t.stage ?? t.node ?? "serpapi",
                      status: (t.status ?? "done") as TraceEvent["status"],
                      engine: t.engine,
                      query: t.query,
                      result_count: t.result_count,
                      timestamp: t.timestamp ?? t.finished_at ?? new Date().toISOString(),
                      duration_ms:
                        t.duration_ms ??
                        (t.started_at && t.finished_at ? Math.max(0, new Date(t.finished_at).getTime() - new Date(t.started_at).getTime()) : undefined),
                      reason: t.reason,
                    }) as TraceEvent,
                ),
              );
            }
          }).catch(() => setStatus("error"));
        } else {
          setStatus((s) => (s === "done" ? s : "error"));
        }
        return;
      }
      setStatus("connecting");
      const jitterFactor = Math.random() * 0.3;
      const backoff = Math.min(2 * Math.pow(2, retryRef.current), 30);
      retryRef.current += 1;
      timerRef.current = window.setTimeout(connect, (backoff + backoff * jitterFactor) * 1000) as unknown as number;
    };
  }, [sessionId, query, onFinal, status]);

  const run = useCallback(() => {
    if (!query) return;
    setEvents([]);
    setFinal(null);
    fallbackTried.current = false;
    retryRef.current = 0;
    if (timerRef.current) clearTimeout(timerRef.current);
    wsRef.current?.close();
    connect();
  }, [connect, query]);

  // visibility pause — pause WS when tab hidden, resume when visible
  useEffect(() => {
    const onVis = () => {
      if (isVisible() && wsRef.current?.readyState !== WebSocket.OPEN && status !== "done" && status !== "idle") connect();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [connect, status]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { events, final, status, run, jitter };
}

// fetchResearchRun alias — POST /api/research/run wired for non-WS fallback
export async function fetchResearchRun(query: string) {
  return postResearchRun(query);
}

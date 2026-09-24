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
  reason?: string;
};

export const ring: TraceEvent[] = [];

export function pushTrace(e: TraceEvent) {
  ring.push(e);
  if (ring.length > 100) ring.shift();
  (window as any).__AAJ_TRACE = ring;
}

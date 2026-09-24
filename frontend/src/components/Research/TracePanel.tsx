import type { TraceEvent } from "@/api/useResearchWS";
import { EngineBadge } from "@/lib/serpapi/originBadge";

const LANES: { id: string; title: string; hint: string; nodes: string[] }[] = [
  { id: "discover", title: "Discover", hint: "SerpApi news & trends", nodes: ["resolve", "market_pull", "news_search", "trends_search"] },
  { id: "corroborate", title: "Corroborate", hint: "AIS · FRED · EIA", nodes: ["physical_corroborate", "physical_corrorobate"] },
  { id: "synthesize", title: "Synthesize", hint: "Web + report", nodes: ["decide_followup", "web_search", "synthesize"] },
];

function laneEvents(events: TraceEvent[], nodes: string[]) {
  return events.filter((e) => nodes.includes(e.node));
}

function statusDot(status: TraceEvent["status"]) {
  if (status === "done") return "bg-success";
  if (status === "skipped") return "bg-warning";
  return "bg-voltage animate-pulse";
}

export function TracePanel({ events }: { events: TraceEvent[] }) {
  const isPending = events.length === 0;

  return (
    <div className="terminal-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink-muted">Agent trace</span>
        <span className="text-[10px] font-mono text-ink-dim">{events.length} steps</span>
      </div>

      {isPending && (
        <div className="space-y-2">
          {LANES.map((lane) => (
            <div key={lane.id} className="h-10 rounded-md bg-raised/60 border border-border-subtle animate-pulse" />
          ))}
          <p className="text-[11px] text-ink-dim px-1">Running discovery…</p>
        </div>
      )}

      {LANES.map((lane) => {
        const evs = laneEvents(events, lane.nodes);
        const done = evs.filter((e) => e.status === "done").length;
        const open = isPending || evs.length > 0;
        return (
          <details key={lane.id} className="group border border-border-subtle rounded-lg bg-panel overflow-hidden" open={open}>
            <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none text-xs font-medium">
              <span className={`h-2 w-2 rounded-full shrink-0 ${evs.length && done === evs.length ? "bg-success" : evs.length ? "bg-warning" : "bg-ink-faint"}`} />
              <span className="uppercase tracking-[0.06em]">{lane.title}</span>
              <span className="text-ink-dim font-mono text-[10px]">{done}/{evs.length || "—"}</span>
              <span className="ml-auto text-[10px] text-ink-dim hidden sm:inline">{lane.hint}</span>
            </summary>
            <div className="border-t border-border-subtle divide-y divide-border-subtle">
              {evs.length === 0 && <p className="px-3 py-2 text-[11px] text-ink-dim">Waiting…</p>}
              {evs.map((e, i) => (
                <div key={`${e.node}-${i}`} className="px-3 py-2 flex items-start gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(e.status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink leading-snug">{e.label || e.node}</div>
                    {e.query && (
                      <div className="font-mono text-[10px] text-ink-dim truncate mt-0.5" title={e.query}>
                        {e.query}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {e.engine && <EngineBadge engine={e.engine} />}
                    <span className="text-[10px] font-mono text-ink-dim">
                      {e.result_count != null ? `${e.result_count} · ` : ""}
                      {e.duration_ms != null ? `${e.duration_ms}ms` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

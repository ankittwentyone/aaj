import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchEvents, fetchEventChain } from "@/api/client";
import { TTL_S } from "@/lib/ttls";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { useInstrument } from "@/context/InstrumentContext";

export default function EventsPage() {
  const { ticker } = useInstrument();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["events", "oil markets geopolitics", 20],
    queryFn: () => fetchEvents("oil markets geopolitics", 20),
    staleTime: Infinity,
    gcTime: TTL_S["events"] * 1000,
  });
  const clusters = data?.clusters ?? data?.events ?? [];
  const asking: string[] = (() => {
    const w = data?.what_people_are_asking;
    if (Array.isArray(w)) return w.map((x: any) => (typeof x === "string" ? x : x.query ?? x.title ?? ""));
    return [];
  })();
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTitle = activeId ? clusters.find((c: any, i: number) => String(c.id ?? c.title ?? i) === activeId)?.title ?? activeId : null;
  const { data: chain, isFetching: chainLoading, isError: chainError } = useQuery({
    queryKey: ["event-chain", activeId],
    queryFn: () => fetchEventChain(activeId!),
    enabled: !!activeId,
    staleTime: TTL_S["events"] * 1000,
  });

  if (isLoading) return <div className="terminal-page p-8 text-ink-muted">Loading events…</div>;
  if (isError) return <div className="terminal-page p-8 text-danger">Failed to load events</div>;

  if (!clusters.length) {
    return (
      <div className="terminal-page p-8 text-ink-muted">
        No fresh catalysts — last checked {new Date().toLocaleTimeString()}{" "}
        <span className="risk-pill risk-pill--stale ml-2">Seed · Stale</span>
      </div>
    );
  }

  return (
    <div className="terminal-page flex flex-col lg:flex-row gap-6 min-h-0 flex-1">
      <div className="flex-1 space-y-3">
        <Breadcrumb section="Events" ticker={ticker} />
        {asking.length > 0 && (
          <div className="terminal-panel p-3">
            <div className="text-[11px] font-mono uppercase text-ink-dim mb-2">What people are asking</div>
            <div className="flex flex-wrap gap-2">
              {asking.slice(0, 6).map((q, i) => (
                <Link
                  key={i}
                  to={`/research?research=${encodeURIComponent(q)}`}
                  className="text-xs font-mono px-2 py-1 rounded-pill border border-border-subtle hover:bg-hover"
                >
                  {q}
                </Link>
              ))}
            </div>
          </div>
        )}
        {clusters.map((c: any, i: number) => {
          const id = String(c.id ?? c.title ?? c.cluster_title ?? i);
          const isActive = activeId === id;
          const chokes: string[] = c.chokepoint_ids ?? [];
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveId(isActive ? null : id)}
              className={`w-full text-left terminal-card p-4 transition-colors ${isActive ? "border-voltage bg-hover" : "hover:bg-hover"}`}
            >
              <div className="text-sm font-medium">{c.title ?? c.cluster_title ?? JSON.stringify(c).slice(0, 120)}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {chokes.map((cp) => (
                  <Link key={cp} to={`/map?choke=${encodeURIComponent(cp)}`} className="text-[11px] font-mono text-voltage hover:underline" onClick={(e) => e.stopPropagation()}>
                    {cp}
                  </Link>
                ))}
              </div>
              <div className="text-[11px] font-mono text-ink-dim mt-1">{isActive ? "▾ chain open" : "▸ view chain"}</div>
            </button>
          );
        })}
      </div>
      {activeId && (
        <div className="w-full lg:w-[360px] shrink-0 terminal-card p-4 h-fit lg:sticky lg:top-[80px] border border-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Event Chain</h3>
            <button type="button" onClick={() => setActiveId(null)} className="text-xs text-ink-muted hover:text-ink px-2 py-1 border border-border-subtle rounded-pill">Close</button>
          </div>
          {chainLoading && <div className="text-xs text-ink-muted">Loading chain…</div>}
          {chainError && <div className="text-xs text-danger">Chain unavailable</div>}
          {!chainLoading && chain && (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] tracking-[0.08em] uppercase text-ink-dim">Category</div>
                <div className="text-sm font-medium">{(chain as any).category ?? "—"}</div>
              </div>
              <div>
                <div className="text-[11px] tracking-[0.08em] uppercase text-ink-dim">Commodity</div>
                <div className="inline-flex items-center px-2 py-1 rounded-pill bg-voltage text-voltage-foreground text-xs font-semibold">{(chain as any).commodity ?? "BRENT"}</div>
              </div>
              <div>
                <div className="text-[11px] tracking-[0.08em] uppercase text-ink-dim">Sectors</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {((chain as any).sectors ?? []).map((s: string) => (
                    <span key={s} className="px-2 py-1 rounded-pill bg-raised border border-border-subtle text-xs">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] tracking-[0.08em] uppercase text-ink-dim">Companies</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {((chain as any).companies ?? []).map((c: string) => (
                    <Link key={c} to={`/asset/${c}`} className="px-2 py-1 rounded-pill bg-panel border border-border-default text-xs font-mono hover:bg-hover">{c}</Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

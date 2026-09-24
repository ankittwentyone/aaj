import { staleTier } from "@/lib/staleTier";
import { TTL_S } from "@/lib/ttls";
import { _summarize_evidence } from "@/lib/summarizeEvidence";
import { cn } from "@/lib/utils";

export function EvidenceCard({ evidence, dataset = "market-home" }: { evidence: any[]; dataset?: string }) {
  const { count, hasSkipped, display } = _summarize_evidence(evidence);
  if (count === 0) return <span className="text-ink-muted text-xs">{hasSkipped ? "provider skipped" : "no evidence — seed era"} · Investigate?</span>;
  const ttl = TTL_S[dataset] ?? 60;
  return (
    <div className="rounded-lg border border-border-subtle bg-panel p-3 min-w-[280px]">
      <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink-muted mb-2">Evidence · {count}</div>
      {display.slice(0, 5).map((e, i) => {
        const tier = staleTier({ retrieved_at: e.retrieved_at, stale: e.status === "skipped" ? true : false, status: e.status, ttlSeconds: ttl });
        return (
          <div key={i} className="evidence-row flex items-center gap-2 py-2 text-xs">
            <span className={cn("h-1.5 w-1.5 rounded-pill shrink-0", tier === "fresh" ? "bg-success" : tier === "amber" ? "bg-warning" : "bg-danger")} />
            <span className="text-ink-muted font-mono text-[11px]">{e.provider}:{e.dataset}</span>
            {e.source_url && <a href={e.source_url} target="_blank" rel="noreferrer" className="text-info hover:underline ml-auto">↗</a>}
          </div>
        );
      })}
    </div>
  );
}

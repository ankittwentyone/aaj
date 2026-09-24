import { cn } from "@/lib/utils";

export function EvidenceChip({ provider, dataset, query, source_url, retrieved_at, stale }: any) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle bg-panel px-2.5 py-1 text-[11px] font-mono">
      <span className={cn("h-1.5 w-1.5 rounded-full", stale ? "bg-warning" : "bg-success")} />
      <span className="text-ink-muted">{provider}:{dataset}</span>
      {query && <span className="text-ink-dim">"{query}"</span>}
      {source_url && <a href={source_url} target="_blank" rel="noreferrer" className="text-info hover:underline">↗</a>}
      {retrieved_at && <span className="text-ink-dim">{new Date(retrieved_at).toLocaleTimeString()}</span>}
    </div>
  );
}

import { _summarize_evidence } from "@/lib/summarizeEvidence";
import { VerdictBar } from "./VerdictBar";
import { corroborate } from "@/lib/serpapi/corroborate";

export function VerdictPanel({ data }: { data: any }) {
  const verdict = data?.physical_vs_narrative?.verdict ?? "INSUFFICIENT DATA";
  const { count } = _summarize_evidence(data?.evidence);
  const physical = data?.physical_vs_narrative?.physical_delta_pct;
  const price = data?.physical_vs_narrative?.price_delta_pct;
  const hasStale = data?.physical_corroboration?.stale === true || data?.physical_corroboration?.status === "skipped";
  // G-048 physical-stale message when count<3
  if (count < 3) {
    return (
      <div className="terminal-card p-4 space-y-3">
        <span className="risk-pill risk-pill--stale">Low Confidence</span>
        <p className="text-ink-muted text-sm">Evidence thin — see contradicting sources</p>
        {hasStale && <p className="text-warning text-xs font-mono">Physical corroboration stale — AIS seed fallback · {data?.physical_corroboration?.retrieved_at ?? ""}</p>}
        <div className="pt-2">
          <VerdictBar priceDelta={price ?? 0} physicalDelta={physical ?? 0} />
          <div className="flex justify-between text-[10px] font-mono text-ink-dim mt-1"><span>Physical {physical ?? "—"}%</span><span>Price {price ?? "—"}%</span></div>
        </div>
        <div className="text-[11px] font-mono text-ink-dim">G-020 diverging 44 bar + rising badge wired in AssetPage · low evidence</div>
      </div>
    );
  }
  const chips = corroborate({ evidence: data?.evidence, commodity: data?.ticker });
  return (
    <div className="terminal-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-dim">Verdict</div>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold tracking-[0.06em] uppercase ${verdict === "PHYSICAL" ? "text-success bg-success-dim border-success-border" : verdict === "NARRATIVE-LED" ? "text-warning bg-warning-dim border-warning-border" : "text-ink-muted bg-zinc-900 border-zinc-800"}`}>{verdict}</span>
        {hasStale && <span className="inline-flex items-center rounded-full bg-warning-dim border border-warning-border px-2 py-0.5 text-[10px] font-mono text-warning">Stale · physical seed</span>}
      </div>
      <div className="text-ink font-semibold">{verdict} — Physical {physical ?? "—"}% vs Price {price ?? "—"}%</div>
      <VerdictBar priceDelta={price ?? 0} physicalDelta={physical ?? 0} />
      <div className="flex justify-between text-[10px] font-mono text-ink-dim"><span className="text-success">Physical {physical != null ? `${physical > 0 ? "+" : ""}${physical}%` : "—"}</span><span className="text-warning">Narrative {price != null ? `${price > 0 ? "+" : ""}${price}%` : "—"}</span></div>
      {chips.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{chips.slice(0, 3).map((c, i) => <span key={i} className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono bg-zinc-900 border-zinc-800 text-zinc-400">{c.label}</span>)}</div>}
      <div className="text-[11px] font-mono text-ink-dim">Diverging 44 bar · h-[44px] · physical green vs narrative amber · MIN 520 guards → pills</div>
    </div>
  );
}

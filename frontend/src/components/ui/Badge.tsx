import { staleTier, tierClass, tierLabel } from "@/lib/staleTier";
import { TTL_S } from "@/lib/ttls";
import { cn } from "@/lib/utils";

export function StaleBadge({ retrieved_at, stale, status, dataset = "map:box" }: { retrieved_at?: string | null; stale?: boolean; status?: string; dataset?: string }) {
  const ttl = TTL_S[dataset] ?? 60;
  const tier = staleTier({ retrieved_at, stale, status, ttlSeconds: ttl });
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] uppercase", tierClass[tier])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", tier === "fresh" ? "bg-emerald-400" : tier === "amber" ? "bg-amber-400" : "bg-red-400")} />
      {tierLabel[tier]}
    </span>
  );
}

export function RiskBadge({ variant, children }: { variant: "critical" | "high" | "low" | "info" | "stale"; children: React.ReactNode }) {
  return <span className={`risk-pill risk-pill--${variant}`}>{children}</span>;
}

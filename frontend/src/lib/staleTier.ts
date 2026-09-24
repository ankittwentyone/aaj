// src/lib/staleTier.ts — SINGLE source of truth for freshness.
// Never inline if (stale || Date.now() - retrieved_at > TTL) elsewhere.
export type StaleTier = "fresh" | "amber" | "red";
export type TierInput = {
  retrieved_at?: string | null;
  stale?: boolean;
  status?: "skipped" | string;
  ttlSeconds: number;
};

const MS = 1000;

/** Single source of truth for freshness. Used by EvidenceCard, AnomalyStrip, Map badge, Chart overlay. */
export function staleTier(input: TierInput): StaleTier {
  if (input.status === "skipped") return "red";
  if (input.stale === true) return "red";

  const ts = input.retrieved_at ? Date.parse(input.retrieved_at) : NaN;
  if (Number.isNaN(ts)) return "amber";

  const ageMs = Date.now() - ts;
  const ttlMs = input.ttlSeconds * MS;

  if (ageMs < ttlMs) return "fresh";
  if (ageMs < ttlMs * 3) return "amber";
  return "red";
}

export const tierClass: Record<StaleTier, string> = {
  fresh: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  amber: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  red: "text-red-400 border-red-500/40 bg-red-500/10",
};

export const tierLabel: Record<StaleTier, string> = {
  fresh: "LIVE",
  amber: "CACHED",
  red: "STALE",
};

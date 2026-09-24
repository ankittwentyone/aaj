export type Evidence = {
  provider: string;
  dataset: string;
  retrieved_at?: string;
  source_url?: string | null;
  status?: string;
  reason?: string;
  confidence?: number;
};

export function _summarize_evidence(
  evidence: Evidence[] | undefined | null,
): { count: number; byProvider: Record<string, number>; hasSkipped: boolean; display: Evidence[] } {
  const list = Array.isArray(evidence) ? evidence : [];
  const hasSkipped = list.some((e) => e.status === "skipped");
  const byProvider = list.reduce((m, e) => ((m[e.provider] = (m[e.provider] ?? 0) + 1), m), {} as Record<string, number>);
  return { count: list.length, byProvider, hasSkipped, display: list };
}

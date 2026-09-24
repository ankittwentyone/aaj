import { FaviconImg, getCiteStyle, normalizeProvider } from "@/lib/serpapi/originBadge";
import { normalizeEvidenceList } from "@/lib/normalizeEvidence";

function groupLabel(provider: string, dataset?: string) {
  const p = normalizeProvider(provider);
  if (p === "serpapi") return `SerpApi · ${dataset ?? "search"}`;
  if (p === "fred") return "FRED";
  if (p === "eia") return "EIA";
  if (p === "alphavantage") return "Alpha Vantage";
  if (p === "yfinance") return "Yahoo Finance";
  if (p === "sec") return "SEC EDGAR";
  return p === "correlation" ? "Market correlation" : p;
}

export function ResourcesPanel({ evidence }: { evidence: unknown[] }) {
  const rows = normalizeEvidenceList(evidence);
  const groups = rows.reduce((acc: Record<string, typeof rows>, e) => {
    const k = `${e.provider}:${e.dataset ?? e.engine ?? "data"}`;
    (acc[k] ??= []).push(e);
    return acc;
  }, {});
  const entries = Object.entries(groups).slice(0, 8);

  return (
    <div className="terminal-card p-4">
      <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-ink-muted mb-3">
        Resources <span className="text-ink-dim font-mono normal-case">({rows.length})</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-ink-muted">Sources appear as the agent collects evidence.</p>
      ) : (
        <div className="space-y-2 max-h-[min(62vh,520px)] overflow-y-auto pr-1">
          {entries.map(([key, items]) => {
            const [prov, ds] = key.split(":");
            return (
              <div key={key} className="rounded-lg border border-border-subtle bg-raised/30 p-2.5">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.05em] text-ink-muted">
                  <FaviconImg
                    domain={
                      prov === "serpapi"
                        ? "https://google.com"
                        : prov === "sec"
                          ? "https://sec.gov"
                          : undefined
                    }
                  />
                  <span className="text-ink">{groupLabel(prov, ds)}</span>
                  <span className="ml-auto rounded-pill border border-border-subtle px-1.5 py-0.5">{items.length}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {items.slice(0, 4).map((e, i) => (
                    <li key={i} className="text-[11px] text-ink-dim font-mono truncate flex gap-1.5 items-center">
                      <span className={`shrink-0 rounded-pill border px-1 py-0 text-[9px] ${getCiteStyle({ provider: e.provider })}`}>
                        {normalizeProvider(e.provider)}
                      </span>
                      <span className="truncate">{e.query ?? e.dataset ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function unwrapFiling(rec: any): { form?: string; title?: string; date?: string; url?: string; skipped?: boolean } {
  if (!rec) return {};
  const p = rec.payload ?? rec;
  if (p?.status === "skipped") return { skipped: true };
  return {
    form: p.form ?? p.type ?? rec.form,
    title: p.title ?? p.accession ?? p.companyName ?? "",
    date: p.filing_date ?? p.filedAt ?? p.date,
    url: p.url ?? p.source_url ?? rec.source_url,
  };
}

function unwrapInsider(rec: any): { owner?: string; tx?: string; skipped?: boolean } {
  if (!rec) return {};
  const p = rec.payload ?? rec;
  if (p?.status === "skipped") return { skipped: true };
  return {
    owner: p.owner ?? p.reportingOwner ?? p.name ?? "",
    tx: p.transactionType ?? p.transactionCode ?? "",
  };
}

export function FilingsList({ filings, insider }: { filings: any; insider: any }) {
  const filingSkipped =
    filings?.status === "skipped" ||
    (Array.isArray(filings) && filings[0] && (filings[0].payload?.status === "skipped" || filings[0].status === "skipped"));
  const insiderSkipped =
    insider?.status === "skipped" ||
    (Array.isArray(insider) && insider[0] && (insider[0].payload?.status === "skipped" || insider[0].status === "skipped"));

  if (filingSkipped && insiderSkipped) {
    return <div className="text-ink-dim text-sm">Fundamentals N/A for this asset — SEC filings apply to listed equities.</div>;
  }

  const list = Array.isArray(filings) ? filings.slice(0, 3).map(unwrapFiling).filter((f) => !f.skipped) : [];
  const ins = Array.isArray(insider) ? insider.slice(0, 5).map(unwrapInsider).filter((r) => !r.skipped) : [];

  return (
    <div className="space-y-3">
      {list.map((f, i) => (
        <div key={i} className="flex items-center gap-3 h-10 px-3 border-b border-border-subtle">
          <span className="text-xs font-mono text-ink-muted shrink-0">{f.form ?? "filing"}</span>
          {f.url ? (
            <a href={f.url} target="_blank" rel="noreferrer" className="text-sm text-ink truncate hover:text-voltage">
              {f.title || f.date || "EDGAR"}
            </a>
          ) : (
            <span className="text-sm text-ink truncate">{f.title || f.date || ""}</span>
          )}
          {f.date && <span className="text-[10px] font-mono text-ink-dim ml-auto shrink-0">{f.date}</span>}
        </div>
      ))}
      {ins.map((r, i) => (
        <div key={i} className="flex items-center gap-3 h-8 px-3 border-b border-border-subtle">
          <span className="text-xs text-ink-muted truncate">{r.owner ?? ""}</span>
          <span className="text-xs font-mono ml-auto shrink-0">{r.tx ?? ""}</span>
        </div>
      ))}
      {list.length === 0 && ins.length === 0 && <div className="text-ink-dim text-sm">No filings</div>}
    </div>
  );
}

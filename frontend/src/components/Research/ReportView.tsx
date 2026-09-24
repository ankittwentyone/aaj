import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { getCiteStyle, OriginBadge, FaviconImg, normalizeProvider } from "@/lib/serpapi/originBadge";
import { normalizeEvidenceList, type EvidenceRow } from "@/lib/normalizeEvidence";
import { normalizeReportMarkdown } from "@/lib/normalizeReportMarkdown";

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="report-md__h1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="report-md__h2">
      <span className="report-md__h2-bar" aria-hidden />
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="report-md__h3">{children}</h3>,
  p: ({ children }) => <p className="report-md__p">{children}</p>,
  ul: ({ children }) => <ul className="report-md__ul">{children}</ul>,
  ol: ({ children }) => <ol className="report-md__ol">{children}</ol>,
  li: ({ children }) => <li className="report-md__li">{children}</li>,
  strong: ({ children }) => <strong className="report-md__strong">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="report-md__link">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="report-md__quote">{children}</blockquote>,
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="report-md__code">{children}</code>
    ),
  hr: () => <hr className="report-md__hr" />,
};

function providerLabel(p: string) {
  const n = normalizeProvider(p);
  if (n === "serpapi") return "SerpApi";
  if (n === "sec") return "SEC";
  if (n === "fred") return "FRED";
  if (n === "eia") return "EIA";
  if (n === "alphavantage") return "Alpha Vantage";
  if (n === "yfinance") return "Yahoo Finance";
  if (n === "correlation") return "Market data";
  return n;
}

function WorksCited({ evidence }: { evidence: EvidenceRow[] }) {
  if (!evidence.length) return null;
  return (
    <details className="mt-8 border border-border-subtle rounded-lg bg-raised/40 overflow-hidden">
      <summary className="cursor-pointer px-4 py-3 text-[11px] font-semibold tracking-[0.08em] uppercase text-ink-muted hover:bg-hover">
        Works cited · {evidence.length} sources
      </summary>
      <ol className="divide-y divide-border-subtle border-t border-border-subtle max-h-[min(50vh,420px)] overflow-y-auto">
        {evidence.map((e, i) => (
          <li key={i} className="flex items-start gap-2 px-4 py-2.5 text-xs">
            <span className="font-mono text-ink-dim shrink-0 w-6">[{i + 1}]</span>
            <FaviconImg domain={e.source_url ?? (e.provider === "serpapi" ? "https://google.com" : undefined)} />
            <span className="flex-1 min-w-0">
              <span className={`inline-flex items-center rounded-pill border px-1.5 py-0.5 text-[10px] font-mono uppercase mr-1.5 ${getCiteStyle({ provider: e.provider, dataset: e.dataset ?? e.engine })}`}>
                {providerLabel(e.provider)}
              </span>
              <span className="text-ink-muted font-mono text-[11px]">{e.dataset ?? e.engine}</span>
              {e.query && <span className="text-ink-dim"> — "{e.query}"</span>}
              {e.source_url && (
                <a href={e.source_url} target="_blank" rel="noreferrer" className="block mt-0.5 text-info hover:underline truncate">
                  {safeHostname(e.source_url)}
                </a>
              )}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function ReportView({ report, evidence = [] }: { report: string; evidence?: unknown[] }) {
  const rows = normalizeEvidenceList(evidence);
  const serpapiCount = rows.filter((e) => e.provider === "serpapi").length;
  const total = rows.length;
  const share = total ? ((serpapiCount / total) * 100).toFixed(0) : "0";
  const md = normalizeReportMarkdown(report);

  return (
    <article className="report-md">
      <div className="flex flex-wrap items-center gap-2 mb-6 pb-4 border-b border-border-subtle">
        <OriginBadge provider="serpapi" dataset="google_news" engine="google_news" />
        <span className="inline-flex items-center rounded-pill border border-amber-600/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono text-amber-400">
          Discovery {share}% SerpApi
        </span>
        <span className="text-[11px] font-mono text-ink-dim ml-auto">{total} evidence rows</span>
      </div>

      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={mdComponents}>
        {md}
      </ReactMarkdown>

      {rows.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5 not-prose">
          {rows.slice(0, 10).map((e, i) => (
            <a
              key={i}
              href={e.source_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-mono ${getCiteStyle({ provider: e.provider, dataset: e.dataset ?? e.engine })}`}
            >
              [E{i}] {providerLabel(e.provider)}
            </a>
          ))}
        </div>
      )}

      <WorksCited evidence={rows} />
    </article>
  );
}

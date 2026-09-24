import { Link } from "react-router-dom";

export function Breadcrumb({ section, ticker }: { section: string; ticker?: string }) {
  return (
    <nav className="text-[11px] font-mono text-ink-dim mb-2 flex items-center gap-1.5">
      <Link to="/" className="hover:text-ink">Markets</Link>
      <span>/</span>
      <span className="text-ink-muted">{section}</span>
      {ticker && (
        <>
          <span>/</span>
          <span className="text-ink font-semibold">{ticker}</span>
        </>
      )}
    </nav>
  );
}

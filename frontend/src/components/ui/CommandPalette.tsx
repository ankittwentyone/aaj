import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSearch } from "@/api/client";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [active, setActive] = useState(0);
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || q.length < 1) { setResults([]); return; }
    // 200ms debounce per spec — GET /api/search
    const t = setTimeout(async () => {
      // WHY→research special — "WHY OIL?" opens ResearchDesk with ?research=
      if (/^why(\s+is)?\s+/i.test(q) || q.toLowerCase().startsWith("why")) {
        setResults([{ label: `Research: ${q}`, type: "research", route: `/research?research=${encodeURIComponent(q)}`, scenario: false }]);
        return;
      }
      // -> scenario dispatch — "-> brent shock +10" dispatches cross-market scenario
      if (q.trim().startsWith("->")) {
        const scenario = q.replace(/^->\s*/, "");
        setResults([{ label: `Scenario: ${scenario}`, type: "scenario", route: `/cross-market?shock=${encodeURIComponent(scenario)}`, scenario: true }]);
        return;
      }
      try { const r = await fetchSearch(q, 8); setResults(r.results ?? r ?? []); } catch { setResults([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) { nav(r.route ?? r.url ?? `/asset/${encodeURIComponent(q)}`); onClose(); }
    } else if (e.key === "Escape") { onClose(); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[var(--z-cmdk)] flex items-start justify-center pt-[20vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-overlay" onClick={onClose} />
      <div className="cmdk-panel relative w-[640px] max-w-[90vw] max-h-[60vh] overflow-hidden flex flex-col bg-panel border border-border-subtle rounded-lg shadow-xl">
        <input
          ref={inputRef}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="BRENT, HORMUZ, WHY OIL? — try WHY is BRENT moving? or -> brent +10"
          className="h-12 px-4 text-sm bg-transparent outline-none placeholder:text-ink-dim border-b border-border-subtle"
          aria-activedescendant={results[active] ? `cmdk-${active}` : undefined}
        />
        <div className="overflow-auto p-2" role="listbox">
          {results.map((r, i) => (
            <button
              key={i}
              id={`cmdk-${i}`}
              role="option"
              aria-selected={i === active}
              onClick={() => { nav(r.route ?? r.url ?? `/asset/${encodeURIComponent(q)}`); onClose(); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${i === active ? "bg-hover" : "hover:bg-hover"}`}
            >
              <span className="text-ink-muted text-[11px] uppercase tracking-[0.08em]">{r.type ?? "goto"}</span>
              <span className="text-ink">{r.label ?? r.title ?? r.ticker ?? JSON.stringify(r).slice(0, 60)}</span>
              {r.type === "research" && <span className="ml-auto text-[10px] font-mono bg-amber-500/10 border border-amber-600 text-amber-400 rounded-pill px-1.5 py-0.5">via SerpApi</span>}
              {r.type === "scenario" && <span className="ml-auto text-[10px] font-mono bg-violet-500/10 border border-violet-500/30 text-violet-400 rounded-pill px-1.5 py-0.5">scenario</span>}
            </button>
          ))}
          {q && results.length === 0 && <div className="px-3 py-6 text-center text-ink-muted text-sm">No matches — try BRENT, HORMUZ, or WHY OIL?</div>}
          {!q && <div className="px-3 py-3 text-ink-dim text-xs">↑↓ Navigate · Enter Select · Esc Close · WHY? opens Research · -&gt; scenario dispatch</div>}
        </div>
      </div>
    </div>
  );
}

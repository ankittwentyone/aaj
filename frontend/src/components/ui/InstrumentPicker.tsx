import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchHome } from "@/api/client";
import { TTL_S } from "@/lib/ttls";
import { useInstrument } from "@/context/InstrumentContext";
import { ChangeCell } from "./ChangeCell";
import {
  buildInstrumentGroups,
  filterInstrumentGroups,
  flattenInstrumentOptions,
  type InstrumentOption,
} from "@/lib/instrumentOptions";
import { cn } from "@/lib/cn";

export function InstrumentPicker({ className = "" }: { className?: string }) {
  const { ticker, setTicker } = useInstrument();
  const { data, isLoading } = useQuery({
    queryKey: ["home"],
    queryFn: fetchHome,
    staleTime: TTL_S["market-home"] * 1000,
  });

  const groups = useMemo(() => buildInstrumentGroups(data), [data]);
  const allOptions = useMemo(() => flattenInstrumentOptions(groups), [groups]);
  const current = allOptions.find((o) => o.ticker === ticker) ?? allOptions[0];

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filteredGroups = useMemo(() => filterInstrumentGroups(groups, filter), [groups, filter]);
  const flatFiltered = useMemo(() => flattenInstrumentOptions(filteredGroups), [filteredGroups]);

  useEffect(() => {
    if (!allOptions.length) return;
    if (!allOptions.some((o) => o.ticker === ticker)) setTicker(allOptions[0].ticker);
  }, [allOptions, ticker, setTicker]);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open, filter]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = useCallback(
    (opt: InstrumentOption) => {
      setTicker(opt.ticker);
      setOpen(false);
      setFilter("");
    },
    [setTicker],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatFiltered[active]) {
      e.preventDefault();
      pick(flatFiltered[active]);
    }
  }

  let rowIndex = -1;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg bg-raised border border-border-default hover:border-border-strong hover:bg-hover transition-colors min-w-[148px] max-w-[min(220px,42vw)]"
      >
        <span className="flex flex-col items-start min-w-0 flex-1 text-left leading-tight">
          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-ink-dim">Symbol</span>
          <span className="text-sm font-semibold font-mono truncate w-full">{current?.ticker ?? ticker ?? "—"}</span>
        </span>
        {current && (
          <span className="hidden sm:flex flex-col items-end shrink-0 font-mono text-[10px] tabular-nums">
            <span className="text-ink">{current.quote.displayPrice}</span>
            <ChangeCell changePct={current.quote.changePct} size="sm" />
          </span>
        )}
        <span className="text-ink-dim text-xs shrink-0" aria-hidden>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-[var(--z-cmdk)] w-[min(320px,calc(100vw-2rem))] rounded-lg border border-border-subtle bg-panel shadow-xl overflow-hidden"
          role="dialog"
          aria-label="Choose instrument"
        >
          <div className="p-2 border-b border-border-subtle">
            <input
              ref={inputRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search BRENT, SPX, BTC…"
              className="w-full h-9 px-3 rounded-md bg-canvas border border-border-subtle text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-[min(50vh,360px)] overflow-y-auto py-1">
            {isLoading && <li className="px-3 py-4 text-xs text-ink-muted">Loading watchlist…</li>}
            {!isLoading && flatFiltered.length === 0 && (
              <li className="px-3 py-4 text-xs text-ink-muted">No match — try BRENT or ⌘K</li>
            )}
            {filteredGroups.map((group) => (
              <li key={group.id} role="presentation">
                <div className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-[0.08em] text-ink-dim">{group.label}</div>
                <ul role="group" aria-label={group.label}>
                  {group.items.map((opt) => {
                    rowIndex += 1;
                    const idx = rowIndex;
                    const selected = opt.ticker === ticker;
                    const highlighted = idx === active;
                    return (
                      <li key={opt.ticker} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => pick(opt)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                            highlighted ? "bg-hover" : "hover:bg-hover",
                            selected && "ring-1 ring-inset ring-voltage-border",
                          )}
                        >
                          <span className="font-mono font-semibold w-16 shrink-0">{opt.ticker}</span>
                          <span className="font-mono tabular-nums text-ink-muted text-xs flex-1">{opt.quote.displayPrice}</span>
                          <ChangeCell changePct={opt.quote.changePct} size="sm" />
                          {opt.quote.stale && <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" title="Stale" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          <div className="border-t border-border-subtle px-3 py-2 flex justify-between text-[10px] font-mono text-ink-dim">
            <span>↑↓ navigate · Enter select</span>
            <Link to={`/asset/${encodeURIComponent(ticker)}`} className="text-info hover:underline" onClick={() => setOpen(false)}>
              Open asset →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

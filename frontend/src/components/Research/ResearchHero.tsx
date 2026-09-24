import { InstrumentSelect } from "@/components/ui/InstrumentSelect";
import { useInstrument } from "@/context/InstrumentContext";

const PROMPTS = (ticker: string) => [
  `Why is ${ticker} moving today?`,
  `${ticker} physical vs narrative`,
  `News risk for ${ticker}`,
  `${ticker} cross-market exposure`,
];

export function ResearchHero({
  query,
  onQueryChange,
  onRun,
  status,
  disabled,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onRun: () => void;
  status: string;
  disabled?: boolean;
}) {
  const { ticker, setTicker } = useInstrument();

  return (
    <div className="terminal-panel p-4 space-y-3">
      <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted">Research desk · stock-scoped</div>
      <div className="flex flex-col lg:flex-row gap-3">
        <InstrumentSelect className="shrink-0" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onRun()}
          placeholder={`Why is ${ticker} moving?`}
          className="flex-1 h-11 px-4 rounded-md bg-raised border border-border-default text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={onRun}
          disabled={disabled || !query.trim()}
          className="h-11 px-6 rounded-md bg-voltage text-voltage-foreground text-sm font-semibold disabled:opacity-50 shrink-0"
        >
          Investigate
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {PROMPTS(ticker).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setTicker(ticker);
              onQueryChange(p);
            }}
            className="h-8 px-3 rounded-pill border border-border-subtle text-xs font-mono text-ink-muted hover:bg-hover hover:text-ink"
          >
            {p}
          </button>
        ))}
      </div>
      <div className="text-[11px] font-mono text-ink-dim">Status: {status}</div>
    </div>
  );
}

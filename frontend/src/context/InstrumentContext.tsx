import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "aaj.terminal.instrument";

type InstrumentContextValue = {
  ticker: string;
  setTicker: (t: string) => void;
};

const InstrumentContext = createContext<InstrumentContextValue | null>(null);

function normalizeTickerSymbol(t: string | null | undefined, fallback = "BRENT"): string {
  const next = (t ?? "").trim().toUpperCase();
  return next || fallback;
}

export function InstrumentProvider({ children, defaultTicker = "BRENT" }: { children: ReactNode; defaultTicker?: string }) {
  const [ticker, setTickerState] = useState(() => {
    try {
      return normalizeTickerSymbol(sessionStorage.getItem(STORAGE_KEY), defaultTicker);
    } catch {
      return defaultTicker;
    }
  });

  const setTicker = useCallback((t: string) => {
    const next = normalizeTickerSymbol(t, defaultTicker);
    setTickerState(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, [defaultTicker]);

  const value = useMemo(() => ({ ticker, setTicker }), [ticker, setTicker]);

  return <InstrumentContext.Provider value={value}>{children}</InstrumentContext.Provider>;
}

export function useInstrument() {
  const ctx = useContext(InstrumentContext);
  if (!ctx) throw new Error("useInstrument requires InstrumentProvider");
  return ctx;
}

export function useInstrumentOptional() {
  return useContext(InstrumentContext);
}

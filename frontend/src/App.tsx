import { Routes, Route, useLocation, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import MarketHome from "./routes/MarketHome";
import AssetPage from "./routes/AssetPage";
import WorldMapPage from "./routes/WorldMapPage";
import EventsPage from "./routes/EventsPage";
import CrossMarketPage from "./routes/CrossMarketPage";
import ResearchDesk from "./routes/ResearchDesk";
import ErrorBoundary from "./routes/ErrorBoundary";
import { CommandPalette } from "./components/ui/CommandPalette";
import { InstrumentPicker } from "./components/ui/InstrumentPicker";
import { MarketLegend } from "./components/ui/MarketLegend";

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={
        active
          ? "text-ink font-semibold border-b-2 border-voltage pb-[2px]"
          : "text-ink-muted hover:text-ink"
      }
    >
      {label}
    </Link>
  );
}

function Header({ onOpenPalette }: { onOpenPalette: () => void }) {
  const loc = useLocation();
  const path = loc.pathname;

  return (
    <header className="terminal-header px-4 lg:px-5 gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link to="/" className="font-mono text-[10px] tracking-[0.10em] uppercase text-ink-dim hidden sm:inline shrink-0 hover:text-ink">
          AAJ Terminal
        </Link>
        <nav className="flex gap-3 sm:gap-4 text-[11px] font-mono uppercase tracking-[0.08em] shrink-0">
          <NavLink to="/" label="Markets" active={path === "/"} />
          <NavLink to="/map" label="Map" active={path.startsWith("/map")} />
          <NavLink to="/cross-market" label="Cross" active={path.startsWith("/cross-market")} />
          <NavLink to="/events" label="Events" active={path.startsWith("/events")} />
          <NavLink to="/research" label="Desk" active={path.startsWith("/research")} />
        </nav>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <InstrumentPicker />
        <button
          type="button"
          onClick={onOpenPalette}
          className="text-ink-muted text-xs border border-border-subtle rounded-pill px-2 py-1 hover:bg-hover"
          aria-label="Open command palette"
        >
          ⌘K
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col">
      <Header onOpenPalette={() => setOpen(true)} />
      <MarketLegend />
      <main className="view-motion terminal-shell flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<ErrorBoundary name="MarketHome"><MarketHome /></ErrorBoundary>} />
          <Route path="/asset/:ticker" element={<ErrorBoundary name="Asset"><AssetPage /></ErrorBoundary>} />
          <Route path="/map" element={<ErrorBoundary name="WorldMap"><WorldMapPage /></ErrorBoundary>} />
          <Route path="/events" element={<ErrorBoundary name="Events"><EventsPage /></ErrorBoundary>} />
          <Route path="/cross-market" element={<ErrorBoundary name="CrossMarket"><CrossMarketPage /></ErrorBoundary>} />
          <Route path="/research/:sessionId?" element={<ErrorBoundary name="Research"><ResearchDesk /></ErrorBoundary>} />
          <Route path="*" element={<div className="terminal-page p-8 text-ink-muted">404 — try ⌘K: BRENT, HORMUZ, WHY OIL?</div>} />
        </Routes>
      </main>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

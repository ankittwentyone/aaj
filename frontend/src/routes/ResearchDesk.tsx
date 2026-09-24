import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useResearchWS } from "@/api/useResearchWS";
import { TracePanel } from "@/components/Research/TracePanel";
import { ReportView } from "@/components/Research/ReportView";
import { ResourcesPanel } from "@/components/Research/ResourcesPanel";
import { ResearchHero } from "@/components/Research/ResearchHero";
import { pushTrace } from "@/lib/analytics";
import { useInstrument } from "@/context/InstrumentContext";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { normalizeEvidenceList } from "@/lib/normalizeEvidence";

export default function ResearchDesk() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const { ticker } = useInstrument();
  const initialFromUrl = params.get("research") ?? params.get("q") ?? "";
  const [query, setQuery] = useState(initialFromUrl || `Why is ${ticker} moving today?`);
  const sessionRef = useRef<string>(routeParams.sessionId ?? params.get("session") ?? crypto.randomUUID());
  const sessionId = sessionRef.current;

  const { events, final, status, run } = useResearchWS(sessionId, query, () => {
    pushTrace({ session: sessionId, node: "synthesize", label: "final", stage: "synthesize", status: "done", timestamp: new Date().toISOString() } as any);
  });

  useEffect(() => {
    if (initialFromUrl && status === "idle") run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialFromUrl) setQuery(`Why is ${ticker} moving today?`);
  }, [ticker, initialFromUrl]);

  const evidence = normalizeEvidenceList((final as any)?.evidence ?? []);
  const hasRun = status === "streaming" || status === "connecting" || final != null;
  return (
    <div className="terminal-page space-y-4">
      <Breadcrumb section="Desk" ticker={ticker} />
      <ResearchHero
        query={query}
        onQueryChange={setQuery}
        onRun={run}
        status={status}
        disabled={status === "streaming" || status === "connecting"}
      />

      {hasRun ? (
        <div className="grid grid-cols-1 xl:grid-cols-[min(320px,28vw)_1fr_min(340px,28vw)] gap-4 xl:gap-6 items-start">
          <div className="sticky top-[80px] space-y-3">
            <TracePanel events={events} />
          </div>
          <div className="min-w-0">
            {final ? (
              <div className="terminal-card p-6 lg:p-8 report-shell">
                <ReportView report={final.report} evidence={evidence} />
              </div>
            ) : (
              <div className="terminal-card p-8 text-center">
                <p className="text-sm text-ink-muted">Synthesizing report…</p>
                <p className="text-[11px] font-mono text-ink-dim mt-2">Discovery → corroboration → markdown brief</p>
              </div>
            )}
          </div>
          <div className="sticky top-[80px]">
            <ResourcesPanel evidence={evidence} />
          </div>
        </div>
      ) : (
        <div className="terminal-card p-12 text-center max-w-2xl mx-auto">
          <p className="text-ink-muted text-sm">Pick a symbol above, choose a prompt, and hit Investigate.</p>
          <p className="text-ink-dim text-xs mt-2 font-mono">Trace · Report · Resources appear after you run.</p>
        </div>
      )}
    </div>
  );
}

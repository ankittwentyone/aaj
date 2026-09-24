import { Link } from "react-router-dom";
import { staleTier } from "@/lib/staleTier";
import { TTL_S } from "@/lib/ttls";
import { ChangeCell } from "@/components/ui/ChangeCell";

export function AnomalyStrip({ strip }: { strip: any }) {
  const anomaly = strip?.max_chokepoint_anomaly;
  if (!anomaly?.id) {
    return (
      <div className="h-8 bg-canvas border-y border-border-subtle flex items-center px-3 text-xs text-ink-muted">
        Monitoring chokepoints — no anomaly flagged
      </div>
    );
  }
  const tier = staleTier({ retrieved_at: anomaly.retrieved_at, stale: anomaly.stale, ttlSeconds: TTL_S["map:box"] });
  const pct = anomaly.pct_change != null ? `${anomaly.pct_change > 0 ? "+" : ""}${Number(anomaly.pct_change).toFixed(1)}%` : "—";

  return (
    <div className="h-8 bg-canvas border-y border-border-subtle flex items-center gap-4 px-3 overflow-hidden text-xs">
      <Link to={`/map?choke=${encodeURIComponent(anomaly.id)}`} className="font-mono hover:text-ink flex items-center gap-2">
        <span className={tier === "red" ? "text-danger" : tier === "amber" ? "text-warning" : "text-success"}>
          Chokepoint {String(anomaly.id).toUpperCase()}
        </span>
        <ChangeCell changePct={pct} size="sm" />
      </Link>
      <span className="text-ink-muted">NEWS {strip.news_count ?? 0}</span>
      {tier === "red" && <span className="risk-pill risk-pill--stale text-[10px]">STALE</span>}
    </div>
  );
}

import { Sparkline } from "./Sparkline";
import { useNavigate } from "react-router-dom";
import { AssetIcon } from "@/components/ui/AssetIcon";
import { formatPriceForTicker } from "@/lib/normalizeQuote";

type Props = {
  ticker: string;
  price?: string | number;
  changePct?: string;
  spark?: number[];
  stale?: boolean;
  variant?: "row" | "tile";
};

export function StockRow({ ticker, price = "—", changePct = "", spark = [], stale = false, variant = "row" }: Props) {
  const nav = useNavigate();
  const numPrice = typeof price === "number" ? price : Number(String(price).replace(/[^0-9.-]/g, ""));
  const displayPrice =
    typeof price === "string" && price !== "—" && Number.isNaN(numPrice)
      ? price
      : formatPriceForTicker(ticker, Number.isNaN(numPrice) ? null : numPrice);
  const isUp =
    String(changePct).trim().startsWith("+") ||
    (changePct && !String(changePct).startsWith("-") && Number(String(changePct).replace("%", "").replace("+", "")) > 0);
  const hasChange = String(changePct).length > 0 && String(changePct) !== "—";
  const displaySpark = spark.length >= 2 ? spark : [];

  if (variant === "tile") {
    return (
      <button
        type="button"
        onClick={() => nav(`/asset/${encodeURIComponent(ticker)}`)}
        className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-center transition-colors min-h-[88px] ${
          stale ? "border-zinc-800 bg-zinc-900/40 opacity-60" : "border-border-subtle bg-panel hover:bg-hover"
        }`}
      >
        <AssetIcon ticker={ticker} size={22} />
        <span className="text-[11px] font-semibold tracking-[-0.01em] text-ink">{ticker}</span>
        <span className="font-mono tabular-nums text-[13px] font-medium text-ink">{displayPrice}</span>
        {hasChange ? (
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono tabular-nums font-semibold ${
              isUp ? "text-success bg-success-dim border-success-border" : "text-danger bg-danger-dim border-danger-border"
            }`}
          >
            {String(changePct)}
          </span>
        ) : null}
        <div className="w-[60px] h-[20px] flex-none">
          {displaySpark.length >= 2 ? (
            <Sparkline data={displaySpark} width={60} height={20} positive={isUp} stale={stale} />
          ) : (
            <span className="inline-block w-full h-full rounded-sm bg-zinc-900 opacity-40" />
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => nav(`/asset/${encodeURIComponent(ticker)}`)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors ${
        stale ? "border-zinc-800 bg-zinc-900/40 opacity-60" : "border-border-subtle bg-panel hover:bg-hover"
      }`}
    >
      <AssetIcon ticker={ticker} size={24} />
      <span className="w-[56px] shrink-0 text-[13px] font-semibold tracking-[-0.01em] text-ink truncate">{ticker}</span>
      <span className="shrink-0">
        {displaySpark.length >= 2 ? (
          <Sparkline data={displaySpark} width={60} height={20} positive={isUp} stale={stale} />
        ) : (
          <span className="inline-block w-[60px] h-[20px] rounded-sm bg-zinc-900 opacity-40" />
        )}
      </span>
      <span className="ml-auto font-mono tabular-nums text-[13px] font-medium text-ink truncate min-w-[56px] text-right">
        {displayPrice}
      </span>
      {hasChange ? (
        <span
          className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-mono tabular-nums font-semibold ${
            isUp ? "text-success bg-success-dim border-success-border" : String(changePct).startsWith("-") ? "text-danger bg-danger-dim border-danger-border" : "text-ink-muted bg-zinc-900 border-zinc-800"
          }`}
        >
          {String(changePct)}
        </span>
      ) : (
        <span className="shrink-0 w-[48px]" />
      )}
      {stale && <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" title="STALE" />}
    </button>
  );
}

export type NormalizedQuote = {
  price: number | null;
  changePct: string;
  stale: boolean;
  displayPrice: string;
};

function parsePct(raw: unknown): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (s.endsWith("%")) return s;
  const n = Number(s.replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n)) return s;
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function normalizeQuoteFromRecord(ticker: string, raw: any): NormalizedQuote {
  const stale = raw?.stale === true || raw?.status === "skipped";
  const p = raw?.payload ?? raw;
  const gq = p?.["Global Quote"] ?? p?.quote ?? p;
  let price: number | null = null;
  if (gq?.["05. price"] != null) price = Number(gq["05. price"]);
  else if (gq?.price != null) price = Number(gq.price);
  else if (gq?.close != null) price = Number(gq.close);
  else if (typeof p?.price === "number") price = p.price;

  let changePct = "";
  if (gq?.["10. change percent"]) changePct = parsePct(gq["10. change percent"]);
  else if (gq?.change_pct != null) changePct = parsePct(gq.change_pct);
  else if (price != null && gq?.["08. previous close"]) {
    const prev = Number(gq["08. previous close"]);
    if (!Number.isNaN(prev) && prev !== 0) {
      changePct = parsePct(String(((price - prev) / prev) * 100));
    }
  }

  const displayPrice = formatPriceForTicker(ticker, price);
  return { price, changePct, stale, displayPrice };
}

export function formatPriceForTicker(ticker: string, price: number | null): string {
  if (price == null || Number.isNaN(price)) return "—";
  const t = ticker.toUpperCase();
  const crypto = ["BTC", "ETH"].includes(t);
  const fx = t.includes("USD") || t.length === 6;
  const decimals = crypto ? (price < 1 ? 4 : 2) : fx ? 4 : t === "NATGAS" ? 3 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(price);
}

export function _unwrap_quote(raw: any): { price: number; change_pct?: number; currency?: string } | null {
  const n = normalizeQuoteFromRecord("", raw);
  if (n.price == null) return null;
  return { price: n.price, change_pct: n.changePct ? Number(String(n.changePct).replace("%", "")) : undefined };
}

/** Curated favicon domains — avoid ticker.com random icons. */
const ICON_DOMAIN: Record<string, string> = {
  SPX: "ssga.com",
  NDX: "invesco.com",
  BRENT: "ice.com",
  WTI: "cmegroup.com",
  GOLD: "spdrgoldshares.com",
  COPPER: "cmegroup.com",
  NATGAS: "cmegroup.com",
  EURUSD: "xe.com",
  USDINR: "rbi.org.in",
  US10Y: "treasury.gov",
  BTC: "bitcoin.org",
  ETH: "ethereum.org",
  AAPL: "apple.com",
  MSFT: "microsoft.com",
};

export function iconDomainForTicker(ticker: string): string {
  const t = ticker.toUpperCase();
  return ICON_DOMAIN[t] ?? `${t.toLowerCase()}.com`;
}

export function faviconUrl(domain: string, size = 32): string {
  const host = domain.replace(/^https?:\/\//, "").split("/")[0];
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

export function monogramForTicker(ticker: string): string {
  const t = ticker.toUpperCase();
  if (t.length <= 3) return t;
  return t.slice(0, 2);
}

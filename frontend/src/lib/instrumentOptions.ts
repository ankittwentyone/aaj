import { normalizeQuoteFromRecord, type NormalizedQuote } from "@/lib/normalizeQuote";

export type InstrumentGroupId = "commodities" | "indices" | "fx" | "rates" | "crypto";

export type InstrumentOption = {
  ticker: string;
  quote: NormalizedQuote;
  group: InstrumentGroupId;
};

export type InstrumentGroup = {
  id: InstrumentGroupId;
  label: string;
  items: InstrumentOption[];
};

export type MarketHomePayload = {
  indices?: Record<string, unknown>;
  commodities?: Record<string, unknown>;
  fx?: Record<string, unknown>;
  rates?: unknown;
  crypto?: Record<string, unknown>;
};

const GROUP_LABELS: Record<InstrumentGroupId, string> = {
  commodities: "Commodities",
  indices: "Indices",
  fx: "FX",
  rates: "Rates",
  crypto: "Crypto",
};

function rowsFromRecord(group: InstrumentGroupId, rec?: Record<string, unknown>): InstrumentOption[] {
  if (!rec) return [];
  return Object.entries(rec).map(([ticker, raw]) => ({
    ticker,
    group,
    quote: normalizeQuoteFromRecord(ticker, raw),
  }));
}

export function buildInstrumentGroups(data?: MarketHomePayload | null): InstrumentGroup[] {
  const groups: InstrumentGroup[] = [
    { id: "commodities", label: GROUP_LABELS.commodities, items: rowsFromRecord("commodities", data?.commodities) },
    { id: "indices", label: GROUP_LABELS.indices, items: rowsFromRecord("indices", data?.indices) },
    { id: "fx", label: GROUP_LABELS.fx, items: rowsFromRecord("fx", data?.fx) },
    {
      id: "rates",
      label: GROUP_LABELS.rates,
      items: data?.rates ? [{ ticker: "US10Y", group: "rates", quote: normalizeQuoteFromRecord("US10Y", data.rates) }] : [],
    },
    { id: "crypto", label: GROUP_LABELS.crypto, items: rowsFromRecord("crypto", data?.crypto) },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export function flattenInstrumentOptions(groups: InstrumentGroup[]): InstrumentOption[] {
  return groups.flatMap((g) => g.items);
}

export function filterInstrumentGroups(groups: InstrumentGroup[], query: string): InstrumentGroup[] {
  const q = query.trim().toUpperCase();
  if (!q) return groups;
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((o) => o.ticker.includes(q) || g.label.toUpperCase().includes(q)),
    }))
    .filter((g) => g.items.length > 0);
}

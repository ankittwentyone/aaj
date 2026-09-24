/** Normalize SerpApi autocomplete / asking payloads to display strings. */

function suggestionToString(s: unknown): string {
  if (s == null) return "";
  if (typeof s === "string") return s;
  if (typeof s === "object") {
    const o = s as Record<string, unknown>;
    const q = o.query ?? o.value ?? o.title ?? o.suggestion ?? o.text;
    if (typeof q === "string" && q.length > 0) return q;
    if (typeof o.highlighted === "string") return o.highlighted;
  }
  return "";
}

export function normalizeAskingList(raw: unknown, trendsWrapped?: unknown): string[] {
  const unwrap = (rec: unknown): unknown => {
    if (!rec || typeof rec !== "object") return rec;
    const r = rec as Record<string, unknown>;
    if (r.payload != null) return r.payload;
    return rec;
  };

  const askingRaw = unwrap(raw);

  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) return raw as string[];

  if (Array.isArray(askingRaw)) {
    return askingRaw.map(suggestionToString).filter(Boolean);
  }

  if (askingRaw && typeof askingRaw === "object") {
    const o = askingRaw as Record<string, unknown>;
    for (const key of ["suggestions", "autocomplete", "queries", "google_autocomplete"]) {
      const arr = o[key];
      if (Array.isArray(arr)) {
        return arr.map(suggestionToString).filter(Boolean);
      }
    }
    if (Array.isArray(o.payload)) {
      return (o.payload as unknown[]).map(suggestionToString).filter(Boolean);
    }
  }

  if (typeof askingRaw === "string" && askingRaw.length > 0) return [askingRaw];

  const tAsk = unwrap(trendsWrapped);
  if (tAsk && typeof tAsk === "object") {
    const inner = (tAsk as Record<string, unknown>).what_people_are_asking;
    return normalizeAskingList(inner, undefined);
  }

  return [];
}

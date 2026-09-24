export type ChartRow = { ts: string; close: number; open?: number; high?: number; low?: number; volume?: number };
export type NormalizedChart = { rows: ChartRow[]; tail: ChartRow[] };

function mapRow(r: any): ChartRow | null {
  if (!r || typeof r !== "object") return null;
  const close = r.close ?? r.Close ?? r["4. close"] ?? r.value;
  const ts = r.ts ?? r.time ?? r.date ?? r.Date;
  if (ts == null || close == null) return null;
  return {
    ts: String(ts).slice(0, 10),
    close: Number(close),
    open: r.open != null ? Number(r.open) : r.Open != null ? Number(r.Open) : undefined,
    high: r.high != null ? Number(r.high) : r.High != null ? Number(r.High) : undefined,
    low: r.low != null ? Number(r.low) : r.Low != null ? Number(r.Low) : undefined,
    volume: r.volume != null ? Number(r.volume) : r.Volume != null ? Number(r.Volume) : undefined,
  };
}

/** Backend may return: SourceRecord.payload | {rows,tail} | ChartRow[] | skipped. */
export function _normalize_chart(raw: any): NormalizedChart {
  if (!raw) return { rows: [], tail: [] };
  if (raw.status === "skipped") return { rows: [], tail: [] };
  const body = raw.payload ?? raw;
  if (Array.isArray(body)) {
    const rows = body.map(mapRow).filter(Boolean) as ChartRow[];
    return { rows, tail: rows.slice(-5) };
  }
  if (Array.isArray(body.rows) && body.rows.length && typeof body.rows[0] === "object" && "close" in body.rows[0]) {
    const rows = body.rows.map(mapRow).filter(Boolean) as ChartRow[];
    return { rows, tail: (body.tail ?? rows.slice(-5)) as ChartRow[] };
  }
  if (Array.isArray(body.rows)) {
    const rows = body.rows.map(mapRow).filter(Boolean) as ChartRow[];
    return { rows, tail: rows.slice(-5) };
  }
  if (Array.isArray(body.data)) {
    const rows = body.data.map(mapRow).filter(Boolean) as ChartRow[];
    return { rows, tail: rows.slice(-5) };
  }
  if (body.raw && typeof body.raw === "object") {
    for (const key of Object.keys(body.raw)) {
      if (key.includes("Time Series") && typeof body.raw[key] === "object") {
        const rows: ChartRow[] = [];
        for (const [date, vals] of Object.entries(body.raw[key] as Record<string, any>)) {
          const mapped = mapRow({ ts: date, close: vals?.["4. close"], open: vals?.["1. open"], high: vals?.["2. high"], low: vals?.["3. low"], volume: vals?.["5. volume"] });
          if (mapped) rows.push(mapped);
        }
        rows.sort((a, b) => a.ts.localeCompare(b.ts));
        return { rows, tail: rows.slice(-5) };
      }
    }
  }
  const firstArray = Object.values(body).find((v) => Array.isArray(v) && (v as any[]).length && typeof (v as any[])[0] === "object");
  if (Array.isArray(firstArray)) {
    const rows = (firstArray as any[]).map(mapRow).filter(Boolean) as ChartRow[];
    return { rows, tail: rows.slice(-5) };
  }
  return { rows: [], tail: [] };
}

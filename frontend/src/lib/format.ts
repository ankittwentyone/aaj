const TZ = "Asia/Kolkata";

export const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TZ, dateStyle: "medium", timeStyle: "short", ...opts }).format(new Date(iso));

export const fmtNumber = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat("en-IN", opts).format(n);

export const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${fmtNumber(n, { maximumFractionDigits: 2 })}%`;

export const fmtPrice = (n: number, ccy = "USD") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);

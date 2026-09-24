/** Finance-standard change display: ▲ green / ▼ red / — flat */
export function parseChangePct(changePct?: string | number | null): { dir: "up" | "down" | "flat"; text: string; num: number | null } {
  if (changePct == null || changePct === "" || changePct === "—") return { dir: "flat", text: "—", num: null };
  const raw = String(changePct).replace("%", "").replace("+", "").trim();
  const num = Number(raw);
  if (Number.isNaN(num)) return { dir: "flat", text: String(changePct), num: null };
  if (num > 0) return { dir: "up", text: `+${num.toFixed(2)}%`, num };
  if (num < 0) return { dir: "down", text: `${num.toFixed(2)}%`, num };
  return { dir: "flat", text: "0.00%", num: 0 };
}

export function ChangeCell({
  changePct,
  size = "md",
  showArrow = true,
}: {
  changePct?: string | number | null;
  size?: "sm" | "md" | "lg";
  showArrow?: boolean;
}) {
  const { dir, text } = parseChangePct(changePct);
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "";
  const color = dir === "up" ? "text-success" : dir === "down" ? "text-danger" : "text-ink-muted";
  const sz = size === "lg" ? "text-base" : size === "sm" ? "text-[11px]" : "text-sm";

  return (
    <span className={`inline-flex items-center gap-1 font-mono tabular-nums font-semibold ${color} ${sz}`}>
      {showArrow && arrow ? <span aria-hidden>{arrow}</span> : null}
      <span>{text}</span>
    </span>
  );
}

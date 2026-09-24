// frontend/src/styles/tokens.ts — CANON (mirrors 02_DESIGN_TOKENS.md @theme)
export const zinc = {
  bg: "#09090B",
  panel: "#111113",
  border: "#232327",
  muted: "#A1A1AA",
  text: "#FAFAFA",
  textDim: "#52525B",
} as const;

export const semantic = {
  up: "#4ADE80",
  down: "#FF4444",
  warn: "#F59E0B",
  info: "#60A5FA",
  stale: "#71717A",
} as const;

export const type = {
  mono: `"Geist Mono", ui-monospace, monospace`,
  sans: `"Geist", ui-sans-serif, system-ui`,
  label: `11px / 14px Geist 600 tracking-[0.08em] uppercase`,
  number: `13px / 16px Geist Mono 500 tabular-nums`,
  micro: `10px / 12px Geist Mono 500`,
} as const;

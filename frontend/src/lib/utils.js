import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — single tailwind merge helper (clsx + tailwind-merge).
 * Canonical per plan 05 src/lib/cn.ts — use everywhere, never inline clsx alone.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

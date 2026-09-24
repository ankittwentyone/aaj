import * as React from "react";
import { cn } from "@/lib/utils";

export function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const prevFocus = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    const el = ref.current;
    el?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && el) {
        const focusable = el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); (last as HTMLElement).focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); (first as HTMLElement).focus(); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[var(--z-drawer)] flex items-center justify-center" role="presentation">
      <div className="absolute inset-0 bg-overlay" onClick={onClose} aria-hidden />
      <div
        ref={ref as any}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn("relative bg-panel border border-border-subtle rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-w-[90vw] outline-none")}
      >
        {children}
      </div>
    </div>
  );
}

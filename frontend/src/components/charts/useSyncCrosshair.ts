import { useEffect } from "react";

// Sync timeScale visibleLogicalRange between two lightweight-charts instances
// per 08 §4.1 <16ms ref only
export function useSyncCrosshair(chartA: any | null, chartB: any | null) {
  useEffect(() => {
    if (!chartA || !chartB) return;
    try {
      const tsA = (chartA as any).timeScale();
      const tsB = (chartB as any).timeScale();
      let syncing = false;
      const h1 = (range: any) => {
        if (syncing || !range) return;
        syncing = true;
        try { tsB.setVisibleLogicalRange(range); } catch {}
        syncing = false;
      };
      const h2 = (range: any) => {
        if (syncing || !range) return;
        syncing = true;
        try { tsA.setVisibleLogicalRange(range); } catch {}
        syncing = false;
      };
      tsA.subscribeVisibleLogicalRangeChange(h1);
      tsB.subscribeVisibleLogicalRangeChange(h2);
      return () => {
        try { tsA.unsubscribeVisibleLogicalRangeChange(h1); } catch {}
        try { tsB.unsubscribeVisibleLogicalRangeChange(h2); } catch {}
      };
    } catch {}
  }, [chartA, chartB]);
}

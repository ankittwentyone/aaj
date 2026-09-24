// src/lib/linkedHighlight.ts — single highlightState store (ONE store, not per-component)
// Cross-viz linking: click vessel → highlight owner/commodity across all viz

type HighlightState = {
  mmsi?: string;
  owner?: string;
  commodity?: string;
  chokepointId?: string;
} | null;

let state: HighlightState = null;
const listeners = new Set<() => void>();

export function setHighlight(s: HighlightState) {
  state = s;
  listeners.forEach((l) => l());
}

export function getHighlight(): HighlightState {
  return state;
}

export function subscribeHighlight(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function clearHighlight() {
  setHighlight(null);
}

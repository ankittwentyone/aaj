// src/lib/ttls.ts — dataset TTL registry (mirrors backend/cache/cache.py:31)
export const TTL_S: Record<string, number> = {
  "market-home": 60,
  "asset:quote": 60,
  "asset:chart": 300,
  "asset:trends": 3600,
  "events": 300,
  "cross-market": 3600,
  "map:box": 30,
  "map:history": 3600,
  "geo": 86400,
  "search": 86400,
  "research": 0,
} as const;

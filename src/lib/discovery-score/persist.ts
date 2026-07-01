import { DISCOVERY_BENCHMARK_CATEGORY_KEY, DISCOVERY_SCORE_CACHE_KEY } from "./constants";
import type { DiscoveryScoreCachePayload } from "./types";

const PRESERVED_PARSED_DATA_KEYS = [DISCOVERY_SCORE_CACHE_KEY, DISCOVERY_BENCHMARK_CATEGORY_KEY] as const;

function isCachePayload(value: unknown): value is DiscoveryScoreCachePayload {
  if (!value || typeof value !== "object") return false;
  const cache = value as DiscoveryScoreCachePayload;
  return cache.version === 1 && typeof cache.score === "number" && typeof cache.fingerprint === "string";
}

export function readDiscoveryScoreCache(parsedData: unknown): DiscoveryScoreCachePayload | null {
  if (!parsedData || typeof parsedData !== "object") return null;
  const raw = (parsedData as Record<string, unknown>)[DISCOVERY_SCORE_CACHE_KEY];
  return isCachePayload(raw) ? raw : null;
}

export function writeDiscoveryScoreCache(
  parsedData: Record<string, unknown> | null | undefined,
  payload: DiscoveryScoreCachePayload,
): Record<string, unknown> {
  const base = parsedData && typeof parsedData === "object" ? { ...parsedData } : {};
  return { ...base, [DISCOVERY_SCORE_CACHE_KEY]: payload };
}

/** Keep server-side discovery cache when clients PATCH parsedData without sending it back. */
export function mergeParsedDataPreservingDiscoveryCache(incoming: unknown, existing: unknown): unknown {
  if (!incoming || typeof incoming !== "object") return incoming;
  const existingRecord =
    existing && typeof existing === "object" ? (existing as Record<string, unknown>) : null;
  const next = incoming as Record<string, unknown>;

  for (const key of PRESERVED_PARSED_DATA_KEYS) {
    if (existingRecord?.[key] != null && next[key] == null) {
      next[key] = existingRecord[key];
    }
  }

  if (readDiscoveryScoreCache(next)) return incoming;
  const existingCache = readDiscoveryScoreCache(existing);
  if (!existingCache) return incoming;
  return { ...next, [DISCOVERY_SCORE_CACHE_KEY]: existingCache };
}

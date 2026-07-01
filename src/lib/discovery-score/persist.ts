import { DISCOVERY_SCORE_CACHE_KEY } from "./constants";
import type { DiscoveryScoreCachePayload } from "./types";

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
  const existingCache = readDiscoveryScoreCache(existing);
  if (!existingCache) return incoming;
  const next = incoming as Record<string, unknown>;
  if (readDiscoveryScoreCache(next)) return incoming;
  return { ...next, [DISCOVERY_SCORE_CACHE_KEY]: existingCache };
}

import type { VectorMatchedJob, VectorSearchFilters } from "@/lib/vector-matched-job";
import { getActingUserScope } from "@/lib/client-session";

export const RECOMMENDED_CACHE_TTL_MS = 15 * 60 * 1000;

const CACHE_PREFIX = "kimchi_recommended_jobs_v1";

export type RecommendedCacheEntry = {
  jobs: VectorMatchedJob[];
  filtersKey: string;
  fetchedAt: number;
  matchMode?: string;
  error?: string | null;
};

export function filtersCacheKey(filters: VectorSearchFilters): string {
  const normalized = { ...filters };
  delete normalized.page;
  delete normalized.offset;
  return JSON.stringify(normalized);
}

function storageKey(filtersKey: string): string {
  const scope = typeof window !== "undefined" ? getActingUserScope() : "self";
  return `${CACHE_PREFIX}:${scope}:${filtersKey}`;
}

export function readRecommendedCache(filtersKey: string): RecommendedCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(filtersKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecommendedCacheEntry;
    if (!parsed?.fetchedAt || parsed.filtersKey !== filtersKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeRecommendedCache(entry: RecommendedCacheEntry): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(entry.filtersKey), JSON.stringify(entry));
  } catch {
    /* quota or private mode */
  }
}

export function isCacheFresh(entry: RecommendedCacheEntry, ttlMs = RECOMMENDED_CACHE_TTL_MS): boolean {
  return Date.now() - entry.fetchedAt < ttlMs;
}

export function clearRecommendedCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

import type { VectorMatchedJob, VectorSearchFilters } from "@/lib/vector-matched-job";
import { getActingUserScope } from "@/lib/client-session";

export const RECOMMENDED_CACHE_TTL_MS = 15 * 60 * 1000;

const CACHE_PREFIX = "kimchi_recommended_jobs_v1";

/** In-memory layer survives Opportunities remounts within the same SPA session. */
const memoryByStorageKey = new Map<string, RecommendedCacheEntry>();
const defaultFeedLoadedScopes = new Set<string>();

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

function scopeKey(): string {
  return typeof window !== "undefined" ? getActingUserScope() : "self";
}

function resolveStorageKey(filtersKey: string): string {
  return `${CACHE_PREFIX}:${scopeKey()}:${filtersKey}`;
}

function storageKeyForScope(scope: string, filtersKey: string): string {
  return `${CACHE_PREFIX}:${scope}:${filtersKey}`;
}

/** Move entries when profile resolves actingUserId (cache may have been written under "self"). */
export function migrateRecommendedCacheScope(fromScope: string, toScope: string): void {
  if (typeof window === "undefined" || fromScope === toScope) return;

  const fromPrefix = `${CACHE_PREFIX}:${fromScope}:`;
  for (const [key, entry] of [...memoryByStorageKey.entries()]) {
    if (!key.startsWith(fromPrefix)) continue;
    const filtersKey = key.slice(fromPrefix.length);
    memoryByStorageKey.set(storageKeyForScope(toScope, filtersKey), entry);
    memoryByStorageKey.delete(key);
  }

  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(fromPrefix)) keys.push(key);
    }
    for (const key of keys) {
      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const filtersKey = key.slice(fromPrefix.length);
      sessionStorage.setItem(storageKeyForScope(toScope, filtersKey), raw);
      sessionStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }

  if (defaultFeedLoadedScopes.has(fromScope)) {
    defaultFeedLoadedScopes.delete(fromScope);
    defaultFeedLoadedScopes.add(toScope);
  }
}

export function readRecommendedCache(filtersKey: string): RecommendedCacheEntry | null {
  if (typeof window === "undefined") return null;
  const key = resolveStorageKey(filtersKey);

  const fromMemory = memoryByStorageKey.get(key);
  if (fromMemory?.filtersKey === filtersKey) return fromMemory;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecommendedCacheEntry;
    if (!parsed?.fetchedAt || parsed.filtersKey !== filtersKey) return null;
    memoryByStorageKey.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeRecommendedCache(entry: RecommendedCacheEntry): void {
  if (typeof window === "undefined") return;
  const key = resolveStorageKey(entry.filtersKey);
  memoryByStorageKey.set(key, entry);
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* quota or private mode — memory cache still serves remounts */
  }
}

export function markDefaultRecommendedFeedLoaded(): void {
  defaultFeedLoadedScopes.add(scopeKey());
}

export function hasDefaultRecommendedFeedLoaded(): boolean {
  return defaultFeedLoadedScopes.has(scopeKey());
}

export function isCacheFresh(entry: RecommendedCacheEntry, ttlMs = RECOMMENDED_CACHE_TTL_MS): boolean {
  return Date.now() - entry.fetchedAt < ttlMs;
}

export function clearRecommendedCacheForKey(filtersKey: string): void {
  if (typeof window === "undefined") return;
  const key = resolveStorageKey(filtersKey);
  memoryByStorageKey.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearRecommendedCache(): void {
  if (typeof window === "undefined") return;
  for (const key of memoryByStorageKey.keys()) {
    if (key.startsWith(CACHE_PREFIX)) memoryByStorageKey.delete(key);
  }
  defaultFeedLoadedScopes.clear();
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

/** Test-only reset for unit tests. */
export function resetRecommendedCacheForTests(): void {
  memoryByStorageKey.clear();
  defaultFeedLoadedScopes.clear();
}

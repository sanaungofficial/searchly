/** In-process TTL cache for Hirebase insights — shared cohort keys (not per-user). */

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type Entry = { data: unknown; expiresAt: number };

const store = new Map<string, Entry>();

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function insightsCacheKey(prefix: string, params: Record<string, unknown>): string {
  return `${prefix}:${stableStringify(params)}`;
}

export function getInsightsCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setInsightsCached(key: string, data: unknown, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function clearInsightsCache(): void {
  store.clear();
}

export const INSIGHTS_CACHE_TTL_MS = DEFAULT_TTL_MS;

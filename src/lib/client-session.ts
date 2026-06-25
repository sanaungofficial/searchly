import { clearRecommendedCache } from "@/lib/recommended-jobs-cache";

const ACTING_USER_KEY = "kimchi_acting_user_id";
const SEMANTIC_QUERY_PREFIX = "kimchi_pipeline_semantic_query";
const NETWORK_SEARCH_PREFIX = "kimchi_network_search";

/** Scope client-side caches (recommended jobs, etc.) to the acting workspace user. */
export function setActingUserScope(userId: string | null): void {
  if (typeof window === "undefined") return;
  if (userId) sessionStorage.setItem(ACTING_USER_KEY, userId);
  else sessionStorage.removeItem(ACTING_USER_KEY);
}

export function getActingUserScope(): string {
  if (typeof window === "undefined") return "self";
  return sessionStorage.getItem(ACTING_USER_KEY) ?? "self";
}

function scopedStorageKey(prefix: string): string {
  return `${prefix}:${getActingUserScope()}`;
}

/** Per-user pipeline semantic search — avoids admin queries leaking into client impersonation. */
export function loadScopedSemanticQuery(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(scopedStorageKey(SEMANTIC_QUERY_PREFIX)) ?? "";
  } catch {
    return "";
  }
}

export function saveScopedSemanticQuery(query: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = scopedStorageKey(SEMANTIC_QUERY_PREFIX);
    const trimmed = query.trim();
    if (trimmed) localStorage.setItem(key, trimmed);
    else localStorage.removeItem(key);
  } catch {
    /* quota or private mode */
  }
}

/** Per-user network search box text. */
export function loadScopedNetworkSearch(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(scopedStorageKey(NETWORK_SEARCH_PREFIX)) ?? "";
  } catch {
    return "";
  }
}

export function saveScopedNetworkSearch(query: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = scopedStorageKey(NETWORK_SEARCH_PREFIX);
    const trimmed = query.trim();
    if (trimmed) localStorage.setItem(key, trimmed);
    else localStorage.removeItem(key);
  } catch {
    /* quota or private mode */
  }
}

export function clearClientSessionCaches(): void {
  clearRecommendedCache();
}

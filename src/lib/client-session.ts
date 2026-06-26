import { clearCoachMatchCache } from "@/lib/coach-match-cache";
import { clearNetworkJobsCache } from "@/lib/network-jobs-cache";
import { clearRecommendedCache } from "@/lib/recommended-jobs-cache";

const ACTING_USER_KEY = "kimchi_acting_user_id";
const ADMIN_REVIEW_CLIENT_KEY = "kimchi_admin_review_client_id";
const ADMIN_REVIEW_META_KEY = "kimchi_admin_review_meta";

export type AdminReviewMeta = {
  name?: string | null;
  email?: string | null;
};

/** Persist admin profile-review target (not impersonation) across workspace pages. */
export function setAdminReviewClient(userId: string, meta?: AdminReviewMeta): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ADMIN_REVIEW_CLIENT_KEY, userId);
  if (meta) {
    sessionStorage.setItem(ADMIN_REVIEW_META_KEY, JSON.stringify(meta));
  }
}

export function getAdminReviewClientId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_REVIEW_CLIENT_KEY);
}

export function getAdminReviewMeta(): AdminReviewMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_REVIEW_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminReviewMeta;
  } catch {
    return null;
  }
}

export function clearAdminReviewClient(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_REVIEW_CLIENT_KEY);
  sessionStorage.removeItem(ADMIN_REVIEW_META_KEY);
}

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

const DASHBOARD_VIEW_PREFIX = "kimchi_dashboard_view";

export type StaffDashboardView = "seeker" | "expert";

export function loadStaffDashboardView(userId: string | null): StaffDashboardView {
  if (typeof window === "undefined" || !userId) return "seeker";
  try {
    const v = localStorage.getItem(`${DASHBOARD_VIEW_PREFIX}:${userId}`);
    return v === "expert" ? "expert" : "seeker";
  } catch {
    return "seeker";
  }
}

export function saveStaffDashboardView(userId: string | null, view: StaffDashboardView) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`${DASHBOARD_VIEW_PREFIX}:${userId}`, view);
  } catch {
    /* quota or private mode */
  }
}

export function clearMatchAnalysisCache(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("kimchi-match:")) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function clearClientSessionCaches(): void {
  clearRecommendedCache();
  clearCoachMatchCache();
  clearNetworkJobsCache();
  clearMatchAnalysisCache();
}

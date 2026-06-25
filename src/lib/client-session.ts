import { clearRecommendedCache } from "@/lib/recommended-jobs-cache";

const ACTING_USER_KEY = "kimchi_acting_user_id";

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

export function clearClientSessionCaches(): void {
  clearRecommendedCache();
}

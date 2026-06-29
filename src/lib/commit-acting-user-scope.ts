import { getActingUserScope, setActingUserScope } from "@/lib/client-session";
import { migrateRecommendedCacheScope } from "@/lib/recommended-jobs-cache";

/** Persist acting user and migrate recommended cache off scope "self" when profile resolves. */
export function commitActingUserScope(userId: string | null): void {
  if (typeof window !== "undefined" && userId && getActingUserScope() === "self") {
    migrateRecommendedCacheScope("self", userId);
  }
  setActingUserScope(userId);
}

import {
  clearClientSessionCaches,
  clearAdminReviewClient,
  setAdminReviewClient,
  setActingUserScope,
} from "@/lib/client-session";

/** Open admin profile review (not impersonation) for a client. */
export async function navigateToAdminClientProfile(userId: string): Promise<void> {
  try {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
  } catch {
    /* best-effort — admin review cannot run while impersonating */
  }
  clearClientSessionCaches();
  setActingUserScope(userId);
  setAdminReviewClient(userId);
  window.location.href = `/opportunities?clientUserId=${encodeURIComponent(userId)}`;
}

export async function exitAdminClientReview(): Promise<void> {
  clearAdminReviewClient();
  clearClientSessionCaches();
  setActingUserScope(null);
  window.location.href = "/expert/clients";
}

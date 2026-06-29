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
  const res = await fetch("/api/admin/client-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error("Failed to start client profile review");
  clearClientSessionCaches();
  setActingUserScope(userId);
  setAdminReviewClient(userId);
  window.location.href = `/opportunities?clientUserId=${encodeURIComponent(userId)}`;
}

export async function exitAdminClientReview(): Promise<void> {
  try {
    await fetch("/api/admin/client-review", { method: "DELETE" });
  } catch {
    /* best-effort */
  }
  clearAdminReviewClient();
  clearClientSessionCaches();
  setActingUserScope(null);
  window.location.href = "/expert/clients";
}

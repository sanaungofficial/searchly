import {
  clearClientSessionCaches,
  clearAdminReviewClient,
  setAdminReviewClient,
  setAdminReviewReturnPath,
  getAdminReviewReturnPath,
  getAdminReviewReturnLabel,
  setActingUserScope,
} from "@/lib/client-session";

type ReviewNavigationOptions = {
  returnPath?: string;
  returnLabel?: string;
  destinationPath?: string;
};

async function startAdminClientReview(userId: string): Promise<void> {
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
}

/** Open admin profile review (not impersonation) for a client. */
export async function navigateToAdminClientProfile(userId: string): Promise<void> {
  await startAdminClientReview(userId);
  clearClientSessionCaches();
  setActingUserScope(userId);
  setAdminReviewClient(userId);
  setAdminReviewReturnPath("/expert/clients", "Back to clients");
  window.location.href = `/opportunities?clientUserId=${encodeURIComponent(userId)}`;
}

/** Open admin profile review for an org employee — lands on profile editor. */
export async function navigateToEmployeeProfileReview(
  userId: string,
  options?: ReviewNavigationOptions,
): Promise<void> {
  await startAdminClientReview(userId);
  clearClientSessionCaches();
  setActingUserScope(userId);
  setAdminReviewClient(userId);
  if (options?.returnPath) {
    setAdminReviewReturnPath(options.returnPath, options.returnLabel);
  }
  const destination = options?.destinationPath ?? `/profile?clientUserId=${encodeURIComponent(userId)}`;
  window.location.href = destination;
}

export async function startEmployeeImpersonation(userId: string): Promise<void> {
  const res = await fetch("/api/admin/impersonate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error("Failed to start impersonation");
  const body = (await res.json().catch(() => ({}))) as { user?: { id?: string } };
  clearAdminReviewClient();
  clearClientSessionCaches();
  if (body.user?.id) setActingUserScope(body.user.id);
  window.location.href = "/profile";
}

export async function exitAdminClientReview(): Promise<void> {
  try {
    await fetch("/api/admin/client-review", { method: "DELETE" });
  } catch {
    /* best-effort */
  }
  const returnPath = getAdminReviewReturnPath();
  clearAdminReviewClient();
  clearClientSessionCaches();
  setActingUserScope(null);
  window.location.href = returnPath;
}

export { getAdminReviewReturnLabel };

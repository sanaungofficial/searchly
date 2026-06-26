import { clearClientSessionCaches, setActingUserScope } from "@/lib/client-session";
import { adminClientProfileBase } from "@/lib/workspace-urls";

/** Open admin profile review (not impersonation) for a client. */
export async function navigateToAdminClientProfile(userId: string): Promise<void> {
  try {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
  } catch {
    /* best-effort — admin review cannot run while impersonating */
  }
  clearClientSessionCaches();
  setActingUserScope(null);
  window.location.href = adminClientProfileBase(userId);
}

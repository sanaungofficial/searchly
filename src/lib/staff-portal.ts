/** Coaches and admins share the expert workspace (/expert/*). Job seeker home stays on /dashboard. */
export function isStaffPortalRole(role: string | null | undefined): boolean {
  return role === "COACH" || role === "ADMIN";
}

export const EXPERT_BASE = "/expert";
export const EXPERT_DASHBOARD_PATH = "/expert/dashboard";

/** Expert mode — flat top-level tabs (no nested ops/reviews in nav). */
export const EXPERT_WORKSPACE_NAV = [
  { id: "dashboard", label: "Dashboard", path: EXPERT_DASHBOARD_PATH },
  { id: "inbox", label: "Inbox", path: "/expert/inbox" },
  { id: "clients", label: "Clients", path: "/expert/clients" },
  { id: "offerings", label: "Offerings", path: "/expert/offerings" },
  { id: "live", label: "Live Webinar", path: "/expert/live" },
] as const;

export type ExpertWorkspaceNavId = (typeof EXPERT_WORKSPACE_NAV)[number]["id"];

/** @deprecated Use EXPERT_WORKSPACE_NAV */
export const STAFF_DASHBOARD_NAV = EXPERT_WORKSPACE_NAV;

export function matchStaffDashboardNavPath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function isExpertPortalPath(pathname: string): boolean {
  return pathname === EXPERT_BASE || pathname.startsWith(`${EXPERT_BASE}/`);
}

export function expertWorkspaceNavId(pathname: string): ExpertWorkspaceNavId | null {
  if (pathname.startsWith("/expert/reviews")) return null;
  if (pathname === EXPERT_DASHBOARD_PATH) return "dashboard";
  const match = EXPERT_WORKSPACE_NAV.find(
    (item) => item.id !== "dashboard" && pathname.startsWith(item.path),
  );
  return match?.id ?? null;
}

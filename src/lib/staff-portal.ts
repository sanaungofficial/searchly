/** Coaches and admins share the expert workspace (/expert/*). Job seeker home stays on /dashboard. */
export function isStaffPortalRole(role: string | null | undefined): boolean {
  return role === "COACH" || role === "ADMIN";
}

export const EXPERT_BASE = "/expert";

/** Expert mode — flat top-level tabs (no nested ops/reviews in nav). */
export const EXPERT_WORKSPACE_NAV = [
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
  const match = EXPERT_WORKSPACE_NAV.find((item) => pathname.startsWith(item.path));
  return match?.id ?? null;
}

/** Coaches and admins share the expert workspace (/expert/*). Job seeker home stays on /dashboard. */
export function isStaffPortalRole(role: string | null | undefined): boolean {
  return role === "COACH" || role === "ADMIN";
}

export const EXPERT_BASE = "/expert";

/** Leland-style expert workspace — left sidebar + top Expert mode dropdown. */
export const EXPERT_WORKSPACE_NAV = [
  { id: "inbox", label: "Inbox", path: "/expert/inbox" },
  { id: "offerings", label: "Offerings", path: "/expert/offerings" },
  { id: "reviews", label: "Reviews", path: "/expert/reviews" },
  { id: "ops", label: "Ops Tools", path: "/expert/ops" },
] as const;

export type ExpertWorkspaceNavId = (typeof EXPERT_WORKSPACE_NAV)[number]["id"];

/** @deprecated Use EXPERT_WORKSPACE_NAV — kept for imports that expect STAFF_DASHBOARD_NAV */
export const STAFF_DASHBOARD_NAV = EXPERT_WORKSPACE_NAV;

export function matchStaffDashboardNavPath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/** True when the URL is under /expert (expert mode workspace). */
export function isExpertPortalPath(pathname: string): boolean {
  return pathname === EXPERT_BASE || pathname.startsWith(`${EXPERT_BASE}/`);
}

export function expertWorkspaceNavId(pathname: string): ExpertWorkspaceNavId | null {
  const match = EXPERT_WORKSPACE_NAV.find((item) => pathname.startsWith(item.path));
  return match?.id ?? null;
}

/** Coaches and admins share the expert workspace (Inbox, Clients, Offerings, Reviews). */
export function isStaffPortalRole(role: string | null | undefined): boolean {
  return role === "COACH" || role === "ADMIN";
}

/** Leland-style expert workspace — left sidebar + top Expert dashboard dropdown. */
export const EXPERT_WORKSPACE_NAV = [
  { id: "inbox", label: "Inbox", path: "/dashboard/inbox" },
  { id: "clients", label: "Clients", path: "/dashboard/clients" },
  { id: "offerings", label: "Offerings", path: "/dashboard/offerings" },
  { id: "reviews", label: "Reviews", path: "/dashboard/reviews" },
] as const;

export type ExpertWorkspaceNavId = (typeof EXPERT_WORKSPACE_NAV)[number]["id"];

/** @deprecated Use EXPERT_WORKSPACE_NAV — kept for imports that expect STAFF_DASHBOARD_NAV */
export const STAFF_DASHBOARD_NAV = EXPERT_WORKSPACE_NAV;

export function matchStaffDashboardNavPath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/** True when the URL is an expert-workspace route (not the shared /dashboard home). */
export function isExpertPortalPath(pathname: string): boolean {
  if (pathname.startsWith("/dashboard/clients/") && pathname.includes("/profile")) {
    return false;
  }
  return EXPERT_WORKSPACE_NAV.some((item) => pathname.startsWith(item.path));
}

export function expertWorkspaceNavId(pathname: string): ExpertWorkspaceNavId | null {
  const match = EXPERT_WORKSPACE_NAV.find((item) => pathname.startsWith(item.path));
  return match?.id ?? null;
}

/** Admin sub-routes — shown in top nav dropdown for admins. */
export const ADMIN_NAV = [
  { id: "dashboard", label: "Dashboard", path: "/admin/dashboard" },
  { id: "experts", label: "Directory", path: "/admin/experts" },
  { id: "coaches", label: "Expert hub", path: "/admin/coaches" },
  { id: "bookings", label: "Bookings", path: "/admin/bookings" },
  { id: "purchases", label: "Purchases", path: "/admin/purchases" },
  { id: "live", label: "Live sessions", path: "/admin/live" },
  { id: "prompts", label: "Prompts", path: "/admin/prompts" },
  { id: "company-scans", label: "Company scans", path: "/admin/company-scans" },
] as const;

export function matchAdminNavPath(pathname: string, itemPath: string): boolean {
  if (itemPath === "/admin/dashboard") return pathname === "/admin/dashboard";
  if (itemPath === "/admin/coaches") return pathname.startsWith("/admin/coaches");
  if (itemPath === "/admin/experts") return pathname.startsWith("/admin/experts");
  return pathname.startsWith(itemPath);
}

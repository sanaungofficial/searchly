/** Coaches and admins share the Dashboard staff portal (Clients, Bookings, Live tabs). */
export function isStaffPortalRole(role: string | null | undefined): boolean {
  return role === "COACH" || role === "ADMIN";
}

/** Sub-routes shown under Dashboard in the top nav for staff portal users. */
export const STAFF_DASHBOARD_NAV = [
  { id: "home", label: "Overview", path: "/dashboard" },
  { id: "expert-profile", label: "Expert Profile", path: "/dashboard/expert-profile" },
  { id: "clients", label: "Clients", path: "/dashboard/clients" },
  { id: "bookings", label: "Bookings", path: "/dashboard/bookings" },
  { id: "live", label: "Live", path: "/dashboard/live" },
] as const;

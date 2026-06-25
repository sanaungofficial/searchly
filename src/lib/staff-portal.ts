/** Coaches and admins share the Dashboard staff portal (Clients, Bookings, Live tabs). */
export function isStaffPortalRole(role: string | null | undefined): boolean {
  return role === "COACH" || role === "ADMIN";
}

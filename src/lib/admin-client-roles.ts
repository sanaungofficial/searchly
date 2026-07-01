import { UserRole } from "@prisma/client";

/** Roles that may appear in the admin Clients roster and client-review flows. */
export const ADMIN_ROSTER_CLIENT_ROLES = [UserRole.USER, UserRole.ADMIN] as const;

export function isAdminRosterClientRole(role: UserRole): boolean {
  return (ADMIN_ROSTER_CLIENT_ROLES as readonly UserRole[]).includes(role);
}

export function adminRosterClientWhere(userId: string) {
  return { id: userId, role: { in: [...ADMIN_ROSTER_CLIENT_ROLES] } };
}

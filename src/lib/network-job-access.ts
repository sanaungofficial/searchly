/** Who can see internal network-job fields (fee, guarantee, admin block, TE ids). */

export function canViewNetworkJobInternal(userRole: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  return userRole === "ADMIN" || userRole === "RECRUITER" || userRole === "COACH";
}

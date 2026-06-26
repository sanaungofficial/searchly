import type { NetworkJobListing } from "@/lib/network-job-display";

/** Who can see internal network-job fields (fee, guarantee, admin block, TE ids, recruiter notes). */
export function canViewNetworkJobInternal(
  userRole: string,
  isAdmin: boolean,
  isImpersonating = false
): boolean {
  if (isImpersonating) return false;
  if (isAdmin) return true;
  return userRole === "ADMIN" || userRole === "COACH";
}

/** Server-side: use the logged-in operator, not the impersonated client. */
export function canViewNetworkJobInternalFromSession(
  realDbUser: { role: string } | null,
  isAdmin: boolean,
  isImpersonating: boolean
): boolean {
  if (!realDbUser) return false;
  return canViewNetworkJobInternal(realDbUser.role, isAdmin || realDbUser.role === "ADMIN", isImpersonating);
}

/** Strip internal-only fields before sending network jobs to clients / impersonated sessions. */
export function sanitizeNetworkJobListing(
  job: NetworkJobListing,
  internalView: boolean
): NetworkJobListing {
  if (internalView) return job;
  return {
    ...job,
    recruiterNotes: null,
    fee: null,
    feeType: null,
    guarantee: null,
    guaranteeLabel: null,
    networkStatus: null,
    networkStatusLabel: null,
    topEchelonUrl: null,
    sourceUrl: null,
    adminDetails: [],
  };
}

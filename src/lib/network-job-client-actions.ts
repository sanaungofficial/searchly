import type { NetworkJobListing } from "@/lib/network-job-display";
import type { JobMeta } from "@/lib/job-meta";

type NetworkJobRef = Pick<
  NetworkJobListing,
  "recruiter" | "recruiters" | "applyUrl" | "source" | "topEchelonUrl" | "sourceUrl" | "listingUrl"
>;

type NetworkMetaRef = NonNullable<JobMeta["networkJob"]>;

export function networkJobHasRecruiter(job: NetworkJobRef | NetworkMetaRef): boolean {
  if (job.recruiters?.length) return true;
  return Boolean(job.recruiter?.name?.trim());
}

/** Client-safe external apply link (ExecThread application page when present). */
export function networkJobClientApplyUrl(
  job: NetworkJobRef | NetworkMetaRef,
  internalView: boolean,
): string | null {
  if (internalView) return null;
  const apply = job.applyUrl?.trim();
  return apply || null;
}

/**
 * Top Echelon roles have no client apply URL — Kimchi emails the client's profile to the recruiter.
 */
export function networkJobShowSendProfile(
  job: NetworkJobRef | NetworkMetaRef,
  internalView: boolean,
): boolean {
  if (internalView) return false;
  if (job.source !== "TOPECHELON") return false;
  return !networkJobClientApplyUrl(job, internalView);
}

/** Admin-only partner listing URL (Top Echelon / ExecThread source pages). */
export function networkJobPartnerListingUrl(
  job: NetworkJobRef | NetworkMetaRef,
  internalView: boolean,
): string | null {
  if (!internalView) return null;
  return job.topEchelonUrl ?? job.sourceUrl ?? job.listingUrl ?? null;
}

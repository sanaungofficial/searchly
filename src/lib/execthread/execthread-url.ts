import type { ExecThreadListingRaw } from "@/lib/execthread/types";

const MEMBER_SITE = "https://execthread.com";

export function execThreadListingUrl(job: Pick<ExecThreadListingRaw, "slug" | "_id">): string {
  if (job.slug?.trim()) {
    return `${MEMBER_SITE}/listings/${job.slug.trim()}`;
  }
  return `${MEMBER_SITE}/listings?q=all&sort=most%20relevant&size=30`;
}

export function resolveExecThreadExternalId(job: ExecThreadListingRaw): string {
  return String(job._id);
}

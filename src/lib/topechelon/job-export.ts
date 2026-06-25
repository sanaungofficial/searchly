import type { TopEchelonJobFullExport, TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

export const NETWORK_JOB_SUBRESOURCE_PATHS = {
  agencyDetails: (jobId: string) => [
    `/network/jobs/${jobId}/agency_detail.json`,
    `/network/jobs/${jobId}/agency_details.json`,
  ],
  submissionSummary: (jobId: string) => [
    `/network/jobs/${jobId}/submission_summary.json`,
    `/network/jobs/${jobId}/submissions_summary.json`,
    `/network/jobs/${jobId}/network_submission_summary.json`,
  ],
  shares: (jobId: string) => [
    `/network/jobs/${jobId}/shares.json`,
    `/network/jobs/${jobId}/network_shares.json`,
  ],
  recruiterDetails: (recruiterId: string) => [
    `/recruiters/${recruiterId}.json`,
    `/network/recruiters/${recruiterId}.json`,
    `/users/${recruiterId}.json`,
  ],
} as const;

function readId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export function recruiterIdFromJob(job: TopEchelonNetworkJobRaw): string | null {
  const recruiter = job.recruiter;
  if (!recruiter || typeof recruiter !== "object") return null;
  return readId((recruiter as Record<string, unknown>).id);
}

function unwrapPayload(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const nested = record[key];
    if (nested && typeof nested === "object") return nested;
  }
  return value;
}

function mergeObjects(
  base: Record<string, unknown> | null | undefined,
  extra: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!base && !extra) return null;
  return { ...(base ?? {}), ...(extra ?? {}) };
}

/** Merge list row, detail, and optional sub-resources into one DB-safe raw payload. */
export function mergeNetworkJobExport(
  listSummary: TopEchelonNetworkJobRaw,
  bundle: Omit<TopEchelonJobFullExport, "listSummary" | "fieldKeys">
): TopEchelonNetworkJobRaw {
  const detail = bundle.detail;
  const networkId =
    detail.network_id ??
    detail.networkId ??
    listSummary.network_id ??
    listSummary.networkId ??
    null;

  const merged: TopEchelonNetworkJobRaw = {
    ...listSummary,
    ...detail,
    id: listSummary.id,
    network_id: networkId ?? undefined,
    networkId: networkId ?? undefined,
  };

  const agencyFromDetail =
    (merged.agency_detail ?? merged.agencyDetail) as Record<string, unknown> | null | undefined;
  const agencyFromFetch = unwrapPayload(bundle.agencyDetails, [
    "agency_detail",
    "agencyDetail",
    "agency",
    "agency_details",
    "agencyDetails",
  ]) as Record<string, unknown> | null | undefined;

  const mergedAgency = mergeObjects(agencyFromDetail, agencyFromFetch);
  if (mergedAgency) {
    merged.agency_detail = mergedAgency;
    merged.agencyDetail = mergedAgency;
  }

  const recruiterFromDetail =
    merged.recruiter && typeof merged.recruiter === "object"
      ? (merged.recruiter as Record<string, unknown>)
      : null;
  const recruiterFromFetch = unwrapPayload(bundle.recruiterDetails, [
    "recruiter",
    "user",
    "network_recruiter",
    "networkRecruiter",
  ]) as Record<string, unknown> | null | undefined;

  const mergedRecruiter = mergeObjects(recruiterFromDetail, recruiterFromFetch);
  if (mergedRecruiter) merged.recruiter = mergedRecruiter;

  merged._kimchiExport = {
    fetchedAt: new Date().toISOString(),
    listSummary,
    agencyDetails: bundle.agencyDetails,
    submissionSummary: bundle.submissionSummary,
    shares: bundle.shares,
    recruiterDetails: bundle.recruiterDetails,
  };

  return merged;
}

export function countSubresourceHits(exportBundle: TopEchelonJobFullExport): number {
  let hits = 0;
  if (exportBundle.agencyDetails) hits += 1;
  if (exportBundle.submissionSummary) hits += 1;
  if (exportBundle.shares) hits += 1;
  if (exportBundle.recruiterDetails) hits += 1;
  return hits;
}

export function fieldKeys(value: unknown): string[] | null {
  if (!value || typeof value !== "object") return null;
  return Object.keys(value as object).sort();
}

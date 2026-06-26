import { stripHtml } from "@/lib/topechelon/html";
import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";
import { topEchelonNetworkJobUrl } from "@/lib/topechelon/top-echelon-url";
import { mapTopEchelonNetworkRecruiter } from "@/lib/topechelon/map-network-recruiter";
import { mapAgencyBranding } from "@/lib/topechelon/map-agency-branding";
import { formatCompensationFromRaw } from "@/lib/network-job-format";

function stateAbbrev(state: TopEchelonNetworkJobRaw["state"]): string | null {
  if (!state) return null;
  if (typeof state === "string") return state;
  return state.abbreviation ?? state.name ?? null;
}

function recruiterName(job: TopEchelonNetworkJobRaw): string | null {
  return mapTopEchelonNetworkRecruiter(job)?.name ?? null;
}

function formatFee(fee: string | number | null | undefined, feeType: string | null): string | null {
  if (fee == null || fee === "") return null;
  const base = typeof fee === "number" ? fee.toLocaleString() : String(fee);
  if (feeType === "percentage") return `${base}% of first-year comp`;
  if (feeType === "flat") return `$${base} flat`;
  return base;
}

function coerceCompensationInt(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value);
}

/** Stable TE job id for upsert — prefer numeric API id over detail UUID. */
export function resolveNetworkJobExternalId(job: TopEchelonNetworkJobRaw): string {
  if (typeof job.id === "number") return String(job.id);
  if (typeof job.id === "string" && /^\d+$/.test(job.id)) return job.id;

  const networkId = (job.networkId ?? job.network_id) as string | undefined;
  if (networkId) {
    const suffix = networkId.match(/-(\d+)$/);
    if (suffix?.[1]) return suffix[1];
  }

  for (const key of ["job_id", "jobId", "network_job_id", "networkJobId"]) {
    const value = job[key];
    if (typeof value === "number") return String(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return value;
  }

  return String(job.id);
}

function companyNameFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const host = new URL(website).hostname.replace(/^www\./i, "");
    const label = host.split(".")[0];
    if (!label) return null;
    return label.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return null;
  }
}

/** Prisma-safe row for NetworkJob upsert (no display-only or unknown columns). */
export function toNetworkJobDbRecord(job: TopEchelonNetworkJobRaw) {
  const mapped = mapTopEchelonNetworkJob(job);
  const companyName =
    mapped.companyName ??
    mapped.agencyName ??
    companyNameFromWebsite(mapped.agencyWebsite);

  return {
    source: "TOPECHELON" as const,
    externalId: resolveNetworkJobExternalId(job),
    networkId: mapped.networkId,
    positionTitle: mapped.positionTitle,
    companyName,
    city: mapped.city,
    state: mapped.state,
    location: mapped.location,
    minimumCompensation: coerceCompensationInt(mapped.minimumCompensation),
    maximumCompensation: coerceCompensationInt(mapped.maximumCompensation),
    fee: mapped.fee,
    feeType: mapped.feeType,
    jobType: mapped.jobType,
    remoteOption: mapped.remoteOption,
    description: mapped.description,
    comments: mapped.comments,
    networkStatus: mapped.networkStatus,
    recruiterName: mapped.recruiterName,
    recruiterId: mapped.recruiterId,
    topEchelonUrl: mapped.topEchelonUrl,
    sourceUrl: mapped.topEchelonUrl,
    sharedAt: mapped.sharedAt,
    raw: mapped.raw,
    syncedAt: mapped.syncedAt,
  };
}

export function mapTopEchelonNetworkJob(job: TopEchelonNetworkJobRaw) {
  const city = job.city ?? null;
  const state = stateAbbrev(job.state);
  const location = [city, state].filter(Boolean).join(", ") || null;
  const agency = job.agencyDetail ?? job.agency_detail;
  const branding = mapAgencyBranding(job);
  const jobType = (job.jobType ?? job.job_type ?? null) as string | null;
  const minComp = (job.minimumCompensation ?? job.minimum_compensation) as number | null | undefined;
  const maxComp = (job.maximumCompensation ?? job.maximum_compensation) as number | null | undefined;
  const feeType = (job.feeType ?? job.fee_type ?? null) as string | null;
  const externalId = resolveNetworkJobExternalId(job);
  const descriptionHtml = (job.description ?? null) as string | null;
  const commentsHtml = (job.comments ?? null) as string | null;

  return {
    externalId,
    networkId: (job.networkId ?? job.network_id ?? null) as string | null,
    positionTitle: ((job.positionTitle ?? job.position_title) as string | undefined)?.trim() || "Untitled role",
    companyName:
      branding.agencyName ??
      (agency as { companyName?: string; company_name?: string; name?: string } | undefined)?.companyName ??
      (agency as { company_name?: string } | undefined)?.company_name ??
      (agency as { name?: string } | undefined)?.name ??
      null,
    agencyName: branding.agencyName,
    agencyWebsite: branding.agencyWebsite,
    agencyLogoUrl: branding.agencyLogoUrl,
    city,
    state,
    location,
    minimumCompensation: minComp ?? null,
    maximumCompensation: maxComp ?? null,
    fee: job.fee != null ? String(job.fee) : null,
    feeType,
    jobType,
    remoteOption: (job.remoteOption ?? job.remote_option ?? null) as string | null,
    description: descriptionHtml,
    comments: commentsHtml,
    networkStatus: (job.networkStatus ?? job.network_status ?? null) as string | null,
    recruiterName: recruiterName(job),
    recruiterId: job.recruiter?.id != null ? String(job.recruiter.id) : null,
    topEchelonUrl: topEchelonNetworkJobUrl(job),
    sharedAt:
      job.mostRecentlySharedAt || job.most_recently_shared_at
        ? new Date((job.mostRecentlySharedAt ?? job.most_recently_shared_at) as string)
        : null,
    raw: job as object,
    syncedAt: new Date(),
    // Derived display helpers stored alongside for API responses
    _display: {
      salary: formatCompensationFromRaw(job),
      feeLabel: formatFee(job.fee as string | number | null | undefined, feeType),
      descriptionText: stripHtml(descriptionHtml),
      recruiterNotesText: stripHtml(commentsHtml),
    },
  };
}

export type MappedNetworkJob = ReturnType<typeof mapTopEchelonNetworkJob>;

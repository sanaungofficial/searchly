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
  const externalId = String(job.id);
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

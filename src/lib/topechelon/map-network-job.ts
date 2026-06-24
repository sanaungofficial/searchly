import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";

function stateAbbrev(state: TopEchelonNetworkJobRaw["state"]): string | null {
  if (!state) return null;
  if (typeof state === "string") return state;
  return state.abbreviation ?? state.name ?? null;
}

function recruiterName(job: TopEchelonNetworkJobRaw): string | null {
  const r = job.recruiter;
  if (!r) return null;
  if (r.name) return r.name;
  const parts = [r.firstName ?? r.first_name, r.lastName ?? r.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

export function mapTopEchelonNetworkJob(job: TopEchelonNetworkJobRaw) {
  const city = job.city ?? null;
  const state = stateAbbrev(job.state);
  const location = [city, state].filter(Boolean).join(", ") || null;
  const agency = job.agencyDetail ?? job.agency_detail;

  return {
    externalId: String(job.id),
    networkId: job.networkId ?? job.network_id ?? null,
    positionTitle: (job.positionTitle ?? job.position_title)?.trim() || "Untitled role",
    companyName: agency?.companyName ?? agency?.company_name ?? agency?.name ?? null,
    city,
    state,
    location,
    minimumCompensation: job.minimumCompensation ?? job.minimum_compensation ?? null,
    maximumCompensation: job.maximumCompensation ?? job.maximum_compensation ?? null,
    fee: job.fee != null ? String(job.fee) : null,
    feeType: job.feeType ?? job.fee_type ?? null,
    jobType: job.jobType ?? job.job_type ?? null,
    remoteOption: job.remoteOption ?? job.remote_option ?? null,
    description: job.description ?? null,
    networkStatus: job.networkStatus ?? job.network_status ?? null,
    recruiterName: recruiterName(job),
    recruiterId: job.recruiter?.id != null ? String(job.recruiter.id) : null,
    sharedAt:
      job.mostRecentlySharedAt || job.most_recently_shared_at
        ? new Date((job.mostRecentlySharedAt ?? job.most_recently_shared_at) as string)
        : null,
    raw: job as object,
    syncedAt: new Date(),
  };
}

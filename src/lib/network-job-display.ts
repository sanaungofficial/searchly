import type { JobMeta } from "@/lib/job-meta";
import type { KanbanCard } from "@/components/scout/workspace-data";
import type { MappedNetworkJob } from "@/lib/topechelon/map-network-job";
import type { MappedNetworkRecruiter } from "@/lib/topechelon/map-network-recruiter";
import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";
import { mapTopEchelonNetworkJob } from "@/lib/topechelon/map-network-job";
import { mapTopEchelonNetworkRecruiter } from "@/lib/topechelon/map-network-recruiter";
import { SEED_RAW_NETWORK_JOBS } from "@/lib/network-job-seed-raw";

export type NetworkRecruiterDisplay = {
  id: string;
  externalId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  agencyName: string | null;
};

export type NetworkJobListing = {
  id: string;
  externalId: string;
  networkId: string | null;
  positionTitle: string;
  companyName: string | null;
  location: string | null;
  salary: string | null;
  jobType: string | null;
  remoteOption: string | null;
  fee: string | null;
  feeType: string | null;
  networkStatus: string | null;
  sharedAt: string | null;
  description: string | null;
  recruiterNotes: string | null;
  topEchelonUrl: string;
  adminDetails: Array<{ label: string; value: string }>;
  recruiter: NetworkRecruiterDisplay | null;
  raw: TopEchelonNetworkJobRaw;
};

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

function recruiterToDisplay(r: MappedNetworkRecruiter): NetworkRecruiterDisplay {
  return {
    id: r.externalId,
    externalId: r.externalId,
    name: r.name ?? "Unknown recruiter",
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    agencyName: r.agencyName,
  };
}

function buildAdminDetails(mapped: MappedNetworkJob, raw: TopEchelonNetworkJobRaw): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: unknown) => {
    if (value == null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length) rows.push({ label, value: value.join(", ") });
      return;
    }
    if (typeof value === "object") {
      rows.push({ label, value: JSON.stringify(value) });
      return;
    }
    rows.push({ label, value: String(value) });
  };

  push("Network ID", mapped.networkId);
  push("Network status", mapped.networkStatus);
  push("TE job ID", mapped.externalId);
  push("Fee", mapped._display.feeLabel ?? mapped.fee);
  push("Guarantee", raw.guarantee);
  push("Guarantee period (days)", raw.guarantee_period ?? raw.guaranteePeriod);
  push("Industries", raw.industries);
  push("Shared", mapped.sharedAt?.toISOString() ?? null);
  push("Job type", mapped.jobType);
  push("Remote option", mapped.remoteOption);
  push("City", mapped.city);
  push("State", mapped.state);
  push("Compensation (min)", mapped.minimumCompensation);
  push("Compensation (max)", mapped.maximumCompensation);

  return rows;
}

export function interpretNetworkJob(raw: TopEchelonNetworkJobRaw): NetworkJobListing {
  const mapped = mapTopEchelonNetworkJob(raw);
  const recruiterRaw = mapTopEchelonNetworkRecruiter(raw);

  return {
    id: mapped.externalId,
    externalId: mapped.externalId,
    networkId: mapped.networkId,
    positionTitle: mapped.positionTitle,
    companyName: mapped.companyName,
    location: mapped.location,
    salary: mapped._display.salary,
    jobType: mapped.jobType,
    remoteOption: mapped.remoteOption,
    fee: mapped._display.feeLabel,
    feeType: mapped.feeType,
    networkStatus: mapped.networkStatus,
    sharedAt: mapped.sharedAt?.toISOString() ?? null,
    description: mapped._display.descriptionText || null,
    recruiterNotes: mapped._display.recruiterNotesText || null,
    topEchelonUrl: mapped.topEchelonUrl,
    adminDetails: buildAdminDetails(mapped, raw),
    recruiter: recruiterRaw ? recruiterToDisplay(recruiterRaw) : null,
    raw,
  };
}

export function buildNetworkProspectCard(
  job: NetworkJobListing,
  drawerId: number
): KanbanCard & { _url?: string; _meta?: JobMeta; _networkJobId?: string } {
  const aiDescription = [job.description, job.recruiterNotes ? `Recruiter notes:\n${job.recruiterNotes}` : null]
    .filter(Boolean)
    .join("\n\n");

  const meta: JobMeta = {
    location: job.location,
    salary: job.salary,
    jobType: job.jobType,
    remote: job.remoteOption?.toLowerCase().includes("remote") ? true : job.remoteOption?.toLowerCase().includes("on-site") ? false : null,
    description: aiDescription || null,
    jobSummary: job.recruiterNotes ?? undefined,
    tags: ["Recruiter network", job.networkStatus ?? "network"].filter(Boolean),
    networkJob: {
      externalId: job.externalId,
      networkId: job.networkId,
      topEchelonUrl: job.topEchelonUrl,
      recruiterNotes: job.recruiterNotes,
      fee: job.fee,
      networkStatus: job.networkStatus,
      adminDetails: job.adminDetails,
      recruiter: job.recruiter,
    },
  };

  const company = job.companyName ?? job.recruiter?.agencyName ?? "Confidential employer";
  const days = daysSince(job.sharedAt);

  return {
    id: drawerId,
    company,
    initials: company.slice(0, 2).toUpperCase(),
    role: job.positionTitle,
    stage: "saved",
    fit: 0,
    jobRef: null,
    days,
    _url: job.topEchelonUrl,
    _meta: meta,
    _networkJobId: job.id,
  };
}

export function previewPlainText(text: string | null | undefined, maxLen = 160): string {
  if (!text) return "";
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen).trim()}…`;
}

export const SEED_NETWORK_JOBS: NetworkJobListing[] = SEED_RAW_NETWORK_JOBS.map(interpretNetworkJob);

export function formatSharedLabel(iso: string | null): string {
  if (!iso) return "Unknown";
  const days = daysSince(iso);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

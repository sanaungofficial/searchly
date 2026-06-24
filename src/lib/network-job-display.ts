import type { JobMeta } from "@/lib/job-meta";
import type { KanbanCard } from "@/components/scout/workspace-data";
import type { MappedNetworkJob } from "@/lib/topechelon/map-network-job";
import { topEchelonNetworkJobUrl, resolveTopEchelonJobWebUuid } from "@/lib/topechelon/top-echelon-url";
import type { MappedNetworkRecruiter } from "@/lib/topechelon/map-network-recruiter";
import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";
import { mapTopEchelonNetworkJob } from "@/lib/topechelon/map-network-job";
import { mapTopEchelonNetworkRecruiter } from "@/lib/topechelon/map-network-recruiter";
import { SEED_RAW_NETWORK_JOBS } from "@/lib/network-job-seed-raw";
import {
  type CompensationBand,
  COMPENSATION_BAND_LABELS,
  compensationBand,
  extractIndustries,
  formatCompensationLabel,
  formatNetworkSharedDate,
  formatNetworkStatus,
} from "@/lib/network-job-format";

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
  city: string | null;
  state: string | null;
  location: string | null;
  industries: string[];
  salary: string | null;
  compensationMin: number | null;
  compensationMax: number | null;
  compensationBand: CompensationBand | null;
  jobType: string | null;
  remoteOption: string | null;
  fee: string | null;
  feeType: string | null;
  guarantee: string | null;
  guaranteeLabel: string | null;
  networkStatus: string | null;
  networkStatusLabel: string | null;
  sharedAt: string | null;
  sharedAtLabel: string;
  sharedAtRelative: string;
  description: string | null;
  recruiterNotes: string | null;
  topEchelonUrl: string | null;
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

function formatGuaranteeLabel(raw: TopEchelonNetworkJobRaw): string | null {
  const text = raw.guarantee != null ? String(raw.guarantee).trim() : "";
  const days = raw.guarantee_period ?? raw.guaranteePeriod;
  if (text && days != null) return `${text} (${days} days)`;
  if (text) return text;
  if (days != null) return `${days} days`;
  return null;
}

function buildAdminDetails(
  mapped: MappedNetworkJob,
  raw: TopEchelonNetworkJobRaw,
  shared: ReturnType<typeof formatNetworkSharedDate>,
  industries: string[],
  salary: string | null
): Array<{ label: string; value: string }> {
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
  push("Network status", formatNetworkStatus(mapped.networkStatus) ?? mapped.networkStatus);
  push("TE API job ID", mapped.externalId);
  push("Big Biller web UUID", resolveTopEchelonJobWebUuid(raw));
  push("Big Biller URL", mapped.topEchelonUrl ?? topEchelonNetworkJobUrl(raw));
  push("Fee", mapped._display.feeLabel ?? mapped.fee);
  push("Guarantee", raw.guarantee);
  push("Guarantee period (days)", raw.guarantee_period ?? raw.guaranteePeriod);
  push("Industries", industries);
  push("Shared", shared.cardLabel);
  push("Job type", mapped.jobType);
  push("Remote option", mapped.remoteOption);
  push("City", mapped.city);
  push("State", mapped.state);
  push("Compensation", salary);
  push("Compensation (min)", mapped.minimumCompensation);
  push("Compensation (max)", mapped.maximumCompensation);

  return rows;
}

export function interpretNetworkJob(raw: TopEchelonNetworkJobRaw): NetworkJobListing {
  const mapped = mapTopEchelonNetworkJob(raw);
  const recruiterRaw = mapTopEchelonNetworkRecruiter(raw);
  const industries = extractIndustries(raw);
  const compensationMin = mapped.minimumCompensation;
  const compensationMax = mapped.maximumCompensation;
  const salary =
    formatCompensationLabel(compensationMin, compensationMax, mapped.jobType) ?? mapped._display.salary;
  const band = compensationBand(compensationMin, compensationMax, mapped.jobType);
  const networkStatusLabel = formatNetworkStatus(mapped.networkStatus);
  const sharedAtIso = mapped.sharedAt?.toISOString() ?? null;
  const shared = formatNetworkSharedDate(sharedAtIso);
  const guarantee = raw.guarantee != null ? String(raw.guarantee) : null;
  const guaranteeLabel = formatGuaranteeLabel(raw);

  return {
    id: mapped.externalId,
    externalId: mapped.externalId,
    networkId: mapped.networkId,
    positionTitle: mapped.positionTitle,
    companyName: mapped.companyName,
    city: mapped.city,
    state: mapped.state,
    location: mapped.location,
    industries,
    salary,
    compensationMin,
    compensationMax,
    compensationBand: band,
    jobType: mapped.jobType,
    remoteOption: mapped.remoteOption,
    fee: mapped._display.feeLabel,
    feeType: mapped.feeType,
    guarantee,
    guaranteeLabel,
    networkStatus: mapped.networkStatus,
    networkStatusLabel,
    sharedAt: sharedAtIso,
    sharedAtLabel: shared.dateLabel,
    sharedAtRelative: shared.relativeLabel,
    description: mapped._display.descriptionText || null,
    recruiterNotes: mapped._display.recruiterNotesText || null,
    topEchelonUrl: mapped.topEchelonUrl,
    adminDetails: buildAdminDetails(mapped, raw, shared, industries, salary),
    recruiter: recruiterRaw ? recruiterToDisplay(recruiterRaw) : null,
    raw,
  };
}

export function buildNetworkProspectCard(
  job: NetworkJobListing,
  drawerId: number,
  options?: { internalView?: boolean }
): KanbanCard & { _url?: string; _meta?: JobMeta; _networkJobId?: string } {
  const internalView = options?.internalView ?? false;
  const aiDescription = [job.description, job.recruiterNotes ? `Recruiter notes:\n${job.recruiterNotes}` : null]
    .filter(Boolean)
    .join("\n\n");

  const meta: JobMeta = {
    location: job.location,
    salary: job.salary,
    jobType: job.jobType,
    remote: job.remoteOption?.toLowerCase().includes("remote")
      ? true
      : job.remoteOption?.toLowerCase().includes("on-site")
        ? false
        : null,
    description: aiDescription || null,
    jobSummary: job.recruiterNotes ?? undefined,
    tags: ["Recruiter network", job.networkStatusLabel ?? job.networkStatus ?? "network"].filter(Boolean),
    networkJob: {
      externalId: job.externalId,
      networkId: job.networkId,
      topEchelonUrl: job.topEchelonUrl,
      recruiterNotes: job.recruiterNotes,
      fee: internalView ? job.fee : null,
      networkStatus: internalView ? (job.networkStatusLabel ?? job.networkStatus) : null,
      adminDetails: internalView ? job.adminDetails : [],
      internalView,
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
    _url: job.topEchelonUrl ?? undefined,
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

/** @deprecated use sharedAtLabel / sharedAtRelative from listing */
export function formatSharedLabel(iso: string | null): string {
  if (!iso) return "Share date unknown";
  return formatNetworkSharedDate(iso).cardLabel;
}

export { COMPENSATION_BAND_LABELS };

import type { ExecThreadListingRaw } from "@/lib/execthread/types";
import { mapExecThreadNetworkJob } from "@/lib/execthread/map-network-job";
import type { MappedExecThreadContact } from "@/lib/execthread/map-network-recruiter";
import type { JobMeta } from "@/lib/job-meta";
import type { KanbanCard } from "@/components/scout/workspace-data";
import type { MappedNetworkJob } from "@/lib/topechelon/map-network-job";
import { topEchelonNetworkJobUrl, resolveTopEchelonJobWebUuid } from "@/lib/topechelon/top-echelon-url";
import type { MappedNetworkRecruiter } from "@/lib/topechelon/map-network-recruiter";
import type { TopEchelonNetworkJobRaw } from "@/lib/topechelon/types";
import { mapTopEchelonNetworkJob } from "@/lib/topechelon/map-network-job";
import { mapTopEchelonNetworkRecruiter } from "@/lib/topechelon/map-network-recruiter";
import type { NetworkJobMatchFields } from "@/lib/network-job-match";
import { SEED_RAW_NETWORK_JOBS } from "@/lib/network-job-seed-raw";
import { parseJobDescriptionSections, hasParsedJobSections } from "@/lib/job-description-parse";
import {
  type CompensationBand,
  COMPENSATION_BAND_LABELS,
  compensationBand,
  extractIndustries,
  formatCompensationFromRaw,
  formatCompensationLabel,
  formatNetworkSharedDate,
  formatNetworkStatus,
} from "@/lib/network-job-format";
import { networkSourceAdminName, networkSourceChannelCode } from "@/lib/network-source-labels";
import {
  networkCardEmployerLabel,
  networkExecThreadRecruitingFirmLabel,
} from "@/lib/network-employer-labels";

export type NetworkRecruiterDisplay = {
  id: string;
  externalId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  agencyName: string | null;
  title?: string | null;
  linkedInUrl?: string | null;
};

export type NetworkJobListing = {
  id: string;
  externalId: string;
  source: "TOPECHELON" | "EXECTHREAD";
  networkId: string | null;
  positionTitle: string;
  companyName: string | null;
  agencyName: string | null;
  agencyWebsite: string | null;
  agencyLogoUrl: string | null;
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
  sourceUrl: string | null;
  adminDetails: Array<{ label: string; value: string }>;
  recruiter: NetworkRecruiterDisplay | null;
  recruiters?: NetworkRecruiterDisplay[];
  applyUrl?: string | null;
  listingUrl?: string | null;
  companySummary?: string | null;
  raw: TopEchelonNetworkJobRaw | ExecThreadListingRaw;
} & Partial<NetworkJobMatchFields>;

/** Best agency label for cards/logos — avoids generic "Recruiting firm". */
export function networkAgencyDisplayName(job: {
  source?: "TOPECHELON" | "EXECTHREAD";
  agencyName?: string | null;
  companyName?: string | null;
  companySummary?: string | null;
  industries?: string[];
  networkId?: string | null;
  recruiter?: { agencyName?: string | null } | null;
}): string {
  if (job.source === "EXECTHREAD") {
    return networkCardEmployerLabel({
      source: "EXECTHREAD",
      companyName: job.companyName,
      companySummary: job.companySummary,
      industries: job.industries,
      agencyName: job.agencyName,
      networkId: job.networkId,
      recruiter: job.recruiter,
    });
  }

  const fromFields =
    job.agencyName?.trim() ||
    job.recruiter?.agencyName?.trim() ||
    job.companyName?.trim() ||
    null;
  if (fromFields) return fromFields;

  const networkId = job.networkId?.trim();
  if (networkId) {
    const prefix = networkId.match(/^([A-Za-z]+\d*)/)?.[1];
    if (prefix) return prefix;
  }

  return "Network";
}

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

  push("Channel", `TE · ${networkSourceAdminName("TOPECHELON")}`);
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

  const kimchi = raw._kimchiExport;
  if (kimchi?.submissionSummary) push("Submission summary", kimchi.submissionSummary);
  if (kimchi?.shares) push("Network shares", kimchi.shares);
  if (kimchi?.fetchedAt) push("Last TE export", kimchi.fetchedAt);

  return rows;
}

export function interpretNetworkJob(raw: TopEchelonNetworkJobRaw): NetworkJobListing {
  const mapped = mapTopEchelonNetworkJob(raw);
  const recruiterRaw = mapTopEchelonNetworkRecruiter(raw);
  const industries = extractIndustries(raw);
  const compensationMin = mapped.minimumCompensation;
  const compensationMax = mapped.maximumCompensation;
  const payTypeHint =
    typeof raw.compensation_type === "string"
      ? raw.compensation_type
      : typeof raw.pay_type === "string"
        ? raw.pay_type
        : null;
  const salary = formatCompensationFromRaw(raw) ?? mapped._display.salary;
  const band = compensationBand(compensationMin, compensationMax, mapped.jobType, payTypeHint);
  const networkStatusLabel = formatNetworkStatus(mapped.networkStatus);
  const sharedAtIso = mapped.sharedAt?.toISOString() ?? null;
  const shared = formatNetworkSharedDate(sharedAtIso);
  const guarantee = raw.guarantee != null ? String(raw.guarantee) : null;
  const guaranteeLabel = formatGuaranteeLabel(raw);

  return {
    id: mapped.externalId,
    externalId: mapped.externalId,
    source: "TOPECHELON",
    networkId: mapped.networkId,
    positionTitle: mapped.positionTitle,
    companyName: mapped.companyName,
    agencyName: mapped.agencyName ?? mapped.companyName,
    agencyWebsite: mapped.agencyWebsite,
    agencyLogoUrl: mapped.agencyLogoUrl,
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
    sourceUrl: mapped.topEchelonUrl,
    adminDetails: buildAdminDetails(mapped, raw, shared, industries, salary),
    recruiter: recruiterRaw ? recruiterToDisplay(recruiterRaw) : null,
    raw,
  };
}

function execThreadContactToDisplay(contact: MappedExecThreadContact): NetworkRecruiterDisplay {
  return {
    id: contact.externalId,
    externalId: contact.externalId,
    name: contact.name ?? "Recruiter contact",
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    agencyName: contact.agencyName,
    title: contact.title,
    linkedInUrl: contact.linkedInUrl,
  };
}

export function interpretExecThreadJob(raw: ExecThreadListingRaw): NetworkJobListing {
  const mapped = mapExecThreadNetworkJob(raw);
  const industries = mapped._display.industries ?? [];
  const sharedAtIso = mapped.sharedAt?.toISOString() ?? null;
  const shared = formatNetworkSharedDate(sharedAtIso);
  const contacts = mapped._display.contacts ?? [];
  const primary = contacts[0] ?? null;

  return {
    id: mapped.externalId,
    externalId: mapped.externalId,
    source: "EXECTHREAD",
    networkId: mapped.networkId,
    positionTitle: mapped.positionTitle,
    companyName: mapped.companyName,
    agencyName: mapped.agencyName,
    agencyWebsite: null,
    agencyLogoUrl: null,
    city: mapped.city,
    state: mapped.state,
    location: mapped.location,
    industries,
    salary: mapped._display.salaryLabel ?? null,
    compensationMin: mapped.minimumCompensation,
    compensationMax: mapped.maximumCompensation,
    compensationBand: compensationBand(mapped.minimumCompensation, mapped.maximumCompensation, mapped.jobType),
    jobType: mapped.jobType,
    remoteOption: mapped.remoteOption,
    fee: null,
    feeType: null,
    guarantee: null,
    guaranteeLabel: null,
    networkStatus: mapped.networkStatus,
    networkStatusLabel: mapped.networkStatus,
    sharedAt: sharedAtIso,
    sharedAtLabel: shared.dateLabel,
    sharedAtRelative: shared.relativeLabel,
    description: mapped.description,
    companySummary: mapped._display.companySummary,
    recruiterNotes: null,
    topEchelonUrl: null,
    sourceUrl: mapped.applyUrl ?? mapped.listingUrl ?? mapped.sourceUrl,
    applyUrl: mapped.applyUrl,
    listingUrl: mapped.listingUrl,
    adminDetails: internalViewAdminDetailsExecThread(mapped, industries, contacts),
    recruiter: primary ? execThreadContactToDisplay(primary) : null,
    recruiters: contacts.map(execThreadContactToDisplay),
    raw,
  };
}

function internalViewAdminDetailsExecThread(
  mapped: ReturnType<typeof mapExecThreadNetworkJob>,
  industries: string[],
  contacts: MappedExecThreadContact[],
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value?.trim()) rows.push({ label, value: value.trim() });
  };
  push("Channel", `ET · ${networkSourceAdminName("EXECTHREAD")}`);
  push("ExecThread ID", mapped.externalId);
  push("Slug", mapped.networkId);
  push("Level", mapped.networkStatus);
  push("Functions", mapped._display.functions);
  push("Travel %", mapped._display.travel);
  push("Recruiting firm", networkExecThreadRecruitingFirmLabel({
    agencyName: mapped.agencyName,
    recruiters: contacts.map((c) => ({ agencyName: c.agencyName })),
  }));
  if (industries.length) push("Industry / company type", industries.join(" · "));
  push("Apply URL", mapped._display.applyUrl);
  push("Listing URL", mapped._display.listingUrl);
  for (const contact of contacts) {
    const label = contact.title ? `${contact.name} (${contact.title})` : contact.name ?? "Recruiter";
    const bits = [contact.email, contact.phone, contact.linkedInUrl, contact.agencyName].filter(Boolean);
    if (bits.length) push(label, bits.join(" · "));
  }
  return rows;
}

export function buildNetworkProspectCard(
  job: NetworkJobListing,
  drawerId: number,
  options?: { internalView?: boolean }
): KanbanCard & { _url?: string; _meta?: JobMeta; _networkJobId?: string } {
  const internalView = options?.internalView ?? false;
  const aiDescription = internalView
    ? [job.description, job.recruiterNotes ? `Recruiter notes:\n${job.recruiterNotes}` : null]
        .filter(Boolean)
        .join("\n\n")
    : job.description?.trim() || "";
  const parsed = parseJobDescriptionSections(aiDescription);
  const company = networkCardEmployerLabel(job);
  const recruitingFirm =
    job.source === "EXECTHREAD" ? networkExecThreadRecruitingFirmLabel(job) : job.agencyName;

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
    jobSummary: hasParsedJobSections(parsed)
      ? parsed.summary || undefined
      : internalView
        ? job.recruiterNotes ?? undefined
        : undefined,
    responsibilities: parsed.responsibilities.length ? parsed.responsibilities : undefined,
    requiredQualifications: parsed.requiredQualifications.length ? parsed.requiredQualifications : undefined,
    preferredQualifications: parsed.preferredQualifications.length ? parsed.preferredQualifications : undefined,
    benefits: parsed.benefits.length ? parsed.benefits : undefined,
    tags: [
      "Recruiter network",
      networkSourceChannelCode(job.source),
      job.networkStatusLabel ?? job.networkStatus ?? "",
      ...(recruitingFirm ? [recruitingFirm] : []),
      ...(job.source === "EXECTHREAD" && job.industries.length ? job.industries.slice(0, 2) : []),
    ].filter(Boolean),
    companySummary: job.companySummary ?? undefined,
    industries: job.industries.length ? job.industries : undefined,
    ...(job.matchScore != null && job.matchScore > 0
      ? {
          vectorMatch: {
            matchScore: job.matchScore,
            matchLabel: job.matchLabel ?? "",
            matchReasons: job.matchReasons ?? [],
            matchedSkills: job.matchedSkills,
            gapSkills: job.gapSkills,
            vectorRank: job.matchRank,
          },
        }
      : {}),
    networkJob: {
      externalId: job.externalId,
      source: job.source,
      networkId: job.networkId,
      topEchelonUrl: job.topEchelonUrl,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl ?? null,
      listingUrl: job.listingUrl ?? null,
      recruiterNotes: internalView ? job.recruiterNotes : null,
      fee: internalView ? job.fee : null,
      networkStatus: internalView ? (job.networkStatusLabel ?? job.networkStatus) : null,
      adminDetails: internalView ? job.adminDetails : [],
      internalView,
      agencyName: job.agencyName,
      agencyWebsite: job.agencyWebsite,
      agencyLogoUrl: job.agencyLogoUrl,
      recruiter: job.recruiter,
      recruiters: job.recruiters ?? (job.recruiter ? [job.recruiter] : []),
    },
  };

  const days = daysSince(job.sharedAt);

  return {
    id: drawerId,
    company,
    initials: company.slice(0, 2).toUpperCase(),
    role: job.positionTitle,
    stage: "saved",
    fit: job.matchScore && job.matchScore > 0 ? job.matchScore : 0,
    jobRef: null,
    days,
    _url: job.applyUrl ?? job.topEchelonUrl ?? job.listingUrl ?? job.sourceUrl ?? undefined,
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

import type { ExecThreadListingRaw } from "@/lib/execthread/types";
import {
  mapExecThreadListingContacts,
  mapExecThreadPrimaryRecruiter,
  recruitingFirmName,
} from "@/lib/execthread/map-network-recruiter";
import { execThreadListingUrl, resolveExecThreadExternalId } from "@/lib/execthread/execthread-url";
import { isGenericNetworkCompanyLabel } from "@/lib/network-employer-labels";
import { stripHtml } from "@/lib/topechelon/html";

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function companyRecord(job: ExecThreadListingRaw): Record<string, unknown> | null {
  const company = job.company;
  if (!company || typeof company !== "object") return null;
  return company as Record<string, unknown>;
}

function locationFromJob(job: ExecThreadListingRaw): {
  city: string | null;
  state: string | null;
  location: string | null;
  remoteOption: string | null;
} {
  const loc = job.locationInfo?.[0];
  const city = loc?.city ?? loc?.areaDisplayName?.split(",")?.[0]?.trim() ?? null;
  const state = loc?.state ?? null;
  const parts = [city, state, loc?.country].filter(Boolean);
  const location = parts.length ? parts.join(", ") : loc?.areaDisplayName ?? null;

  let remoteOption: string | null = null;
  if (job.isRemote || loc?.isRemote) remoteOption = "Remote";
  else if (job.isHybrid || loc?.isHybrid) remoteOption = "Hybrid";
  else if (job.isOnsite) remoteOption = "On-site";

  return { city, state, location, remoteOption };
}

function normalizeFunctions(job: ExecThreadListingRaw): string[] {
  const out: string[] = [];
  const push = (value: string | null | undefined) => {
    if (value?.trim()) out.push(value.trim());
  };

  if (typeof job.funcs === "string") {
    for (const part of job.funcs.split(",")) push(part);
  } else if (Array.isArray(job.funcs)) {
    for (const fn of job.funcs) push(typeof fn === "string" ? fn : fn?.name);
  }

  if (Array.isArray(job.functions)) {
    for (const fn of job.functions) {
      if (typeof fn === "string") push(fn);
      else push(fn?.name ?? fn?.label ?? fn?.value);
    }
  }

  return [...new Set(out)];
}

function industries(job: ExecThreadListingRaw): string[] {
  const out: string[] = [];
  const industry = str(job.industry) ?? str(job.company?.industry);
  const compType = str(job.compType) ?? str(job.company?.type);
  const employeeCount = str(job.company?.employeeCountRange);
  const companyAge = str(job.company?.age);
  if (industry) out.push(industry);
  if (compType) out.push(compType);
  if (employeeCount) out.push(`${employeeCount} employees`);
  if (companyAge) out.push(companyAge);
  return out;
}

function sharedAt(job: ExecThreadListingRaw): Date | null {
  const raw = job.mostRecentlySubmittedDate ?? job.mostRecentlySubmitted ?? job.received_date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTravelPercent(job: ExecThreadListingRaw): string | null {
  if (typeof job.travelPercent === "number" && !Number.isNaN(job.travelPercent)) {
    return `${job.travelPercent}%`;
  }
  // ExecThread UI treats null travelPercent as "Less than 10%".
  if (job.travelPercent === null) return "Less than 10%";
  return null;
}

function resolveApplyUrl(job: ExecThreadListingRaw): string | null {
  const link = job.listingLinkUrl;
  if (link && typeof link === "object") {
    const url = str(link.url);
    if (url) return url;
  }
  return str(job.redirectUrl);
}

function resolveDescriptionText(job: ExecThreadListingRaw): string | null {
  const jobText = stripHtml(
    job.jobDescription ?? job.jobDescriptionSafeHTML ?? job.summary ?? null,
  );
  return jobText || null;
}

function resolveCompanySummary(job: ExecThreadListingRaw): string | null {
  const company = companyRecord(job);
  const companyText = stripHtml(
    job.longCompanyDescription ??
      job.companyDescription ??
      job.companyDescriptionSafeHTML ??
      str(company?.description) ??
      str(job.alternateDescription) ??
      null,
  );
  return companyText || null;
}

function resolveCompanyLinkedInUrl(job: ExecThreadListingRaw): string | null {
  const company = companyRecord(job);
  const direct = str(company?.linkedInUrl);
  if (direct) return direct;
  const linkedInId = str(company?.linkedInId);
  if (!linkedInId) return null;
  if (linkedInId.startsWith("http")) return linkedInId;
  const slug = linkedInId.replace(/^\/company\//, "").replace(/^\//, "");
  return slug ? `https://www.linkedin.com/company/${slug}` : null;
}

function resolveCompensation(job: ExecThreadListingRaw): {
  salary: string | null;
  minimumCompensation: number | null;
  maximumCompensation: number | null;
} {
  const comp = job.compensation;
  if (comp === true) {
    return {
      salary: "Compensation discussed with recruiter",
      minimumCompensation: null,
      maximumCompensation: null,
    };
  }
  if (typeof comp === "string") {
    const salary = comp.trim();
    return {
      salary: salary || null,
      minimumCompensation: null,
      maximumCompensation: null,
    };
  }
  if (!comp || typeof comp !== "object") {
    return { salary: null, minimumCompensation: null, maximumCompensation: null };
  }

  const total = comp.total;
  const min = comp.min ?? total?.rangeLow ?? null;
  const max = comp.max ?? total?.rangeHigh ?? null;
  const currency = str(comp.currency) ?? "USD";
  let salary: string | null = null;
  if (min != null && max != null) salary = `${currency} ${min.toLocaleString()}–${max.toLocaleString()}`;
  else if (min != null) salary = `${currency} ${min.toLocaleString()}+`;
  else if (max != null) salary = `Up to ${currency} ${max.toLocaleString()}`;

  return {
    salary,
    minimumCompensation: min != null ? Math.round(min) : null,
    maximumCompensation: max != null ? Math.round(max) : null,
  };
}

/** Prefer explicit ET company name when provided — confidential flag alone does not redact a named employer. */
function hiringCompanyName(job: ExecThreadListingRaw): string | null {
  const named = str(job.company?.name);
  if (named && !isGenericNetworkCompanyLabel(named)) return named;
  if (job.confidential) return null;
  return named;
}

export function mapExecThreadNetworkJob(job: ExecThreadListingRaw) {
  const { city, state, location, remoteOption } = locationFromJob(job);
  const externalId = resolveExecThreadExternalId(job);
  const functions = normalizeFunctions(job);
  const funcNames = functions.join(", ");
  const travelLabel = formatTravelPercent(job);
  const companySummary = resolveCompanySummary(job);
  const descriptionText = resolveDescriptionText(job);
  const compensation = resolveCompensation(job);
  const primaryRecruiter = mapExecThreadPrimaryRecruiter(job);
  const recruitingFirm = recruitingFirmName(job);
  const applyUrl = resolveApplyUrl(job);
  const listingUrl = execThreadListingUrl(job);
  const company = companyRecord(job);
  const companyLogoUrl = str(company?.logoUrl);
  const companyWebsiteUrl = str(company?.url);
  const companyLinkedInUrl = resolveCompanyLinkedInUrl(job);
  const companyFounded =
    company?.founded != null && String(company.founded).trim() ? String(company.founded).trim() : null;
  const companyType = str(job.compType) ?? str(job.company?.type);
  const companyStockExchange = str(company?.stockExchange) ?? str(job.companyStockExchange);

  const descriptionParts: string[] = [];
  if (descriptionText) descriptionParts.push(`About the Role\n${descriptionText}`);
  if (functions.length) descriptionParts.push(`Functions:\n${functions.join(", ")}`);
  if (travelLabel) descriptionParts.push(`Travel %: ${travelLabel}`);
  if (companySummary) descriptionParts.push(`About the Company\n${companySummary}`);

  return {
    externalId,
    source: "EXECTHREAD" as const,
    networkId: job.slug ?? null,
    positionTitle: job.title?.trim() || "Untitled role",
    companyName: hiringCompanyName(job),
    agencyName: recruitingFirm ?? null,
    city,
    state,
    location,
    minimumCompensation: compensation.minimumCompensation,
    maximumCompensation: compensation.maximumCompensation,
    fee: null as string | null,
    feeType: null as string | null,
    jobType: job.jobType ?? job.type ?? null,
    remoteOption,
    description: descriptionParts.length ? descriptionParts.join("\n\n") : null,
    comments: null as string | null,
    networkStatus: job.level ?? null,
    recruiterName: primaryRecruiter?.name ?? null,
    recruiterId: primaryRecruiter?.externalId ?? null,
    topEchelonUrl: null as string | null,
    sourceUrl: applyUrl ?? listingUrl,
    applyUrl,
    listingUrl,
    sharedAt: sharedAt(job),
    raw: job as object,
    syncedAt: new Date(),
    _display: {
      industries: industries(job),
      functions: funcNames || null,
      travel: travelLabel,
      companySummary,
      descriptionText,
      hasCompensation: Boolean(compensation.salary),
      salaryLabel: compensation.salary,
      applyUrl,
      listingUrl,
      companyLogoUrl,
      companyWebsiteUrl,
      companyLinkedInUrl,
      companyFounded,
      companyType,
      companyStockExchange,
      contacts: mapExecThreadListingContacts(job),
    },
  };
}

/** Prisma-safe row for NetworkJob upsert. */
export function toExecThreadNetworkJobDbRecord(job: ExecThreadListingRaw) {
  const mapped = mapExecThreadNetworkJob(job);
  return {
    source: mapped.source,
    externalId: mapped.externalId,
    networkId: mapped.networkId,
    positionTitle: mapped.positionTitle,
    companyName: mapped.companyName,
    city: mapped.city,
    state: mapped.state,
    location: mapped.location,
    minimumCompensation: mapped.minimumCompensation,
    maximumCompensation: mapped.maximumCompensation,
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
    sourceUrl: mapped.sourceUrl,
    sharedAt: mapped.sharedAt,
    raw: mapped.raw,
    syncedAt: mapped.syncedAt,
  };
}

export type MappedExecThreadNetworkJob = ReturnType<typeof mapExecThreadNetworkJob>;

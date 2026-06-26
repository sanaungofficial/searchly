import type { NetworkJobListing } from "@/lib/network-job-display";
import { networkSourceChannelCode } from "@/lib/network-source-labels";

function splitInputList(value: string): string[] {
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

export type NetworkJobFilterForm = {
  search: string;
  jobTitles: string;
  keywords: string;
  companyName: string;
  agencyName: string;
  industries: string;
  locationCity: string;
  locationState: string;
  sharedAfter: string;
  salaryFrom: string;
  salaryTo: string;
  jobType: string;
  remoteOption: string;
  /** Public channel filter: TE, ET, or empty for all. */
  channel: string;
  networkStatus: string;
  feeQuery: string;
  guaranteeQuery: string;
  feeType: string;
};

export function createEmptyNetworkJobFilterForm(): NetworkJobFilterForm {
  return {
    search: "",
    jobTitles: "",
    keywords: "",
    companyName: "",
    agencyName: "",
    industries: "",
    locationCity: "",
    locationState: "",
    sharedAfter: "",
    salaryFrom: "",
    salaryTo: "",
    jobType: "",
    remoteOption: "",
    channel: "",
    networkStatus: "",
    feeQuery: "",
    guaranteeQuery: "",
    feeType: "",
  };
}

/** @deprecated use createEmptyNetworkJobFilterForm() */
export const EMPTY_NETWORK_JOB_FILTER_FORM: NetworkJobFilterForm = createEmptyNetworkJobFilterForm();

export type NetworkJobFilterSuggestions = {
  companies: string[];
  agencies: string[];
  industries: string[];
  cities: string[];
  states: string[];
  statuses: string[];
  jobTypes: string[];
  remoteOptions: string[];
  feeTypes: string[];
  guarantees: string[];
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function buildNetworkJobFilterSuggestions(jobs: NetworkJobListing[]): NetworkJobFilterSuggestions {
  return {
    companies: uniqueSorted(jobs.map((j) => j.companyName)),
    agencies: uniqueSorted(jobs.map((j) => j.agencyName ?? j.recruiter?.agencyName)),
    industries: uniqueSorted(jobs.flatMap((j) => j.industries)),
    cities: uniqueSorted(jobs.map((j) => j.city)),
    states: uniqueSorted(jobs.map((j) => j.state)),
    statuses: uniqueSorted(jobs.map((j) => j.networkStatusLabel ?? j.networkStatus)),
    jobTypes: uniqueSorted(jobs.map((j) => j.jobType)),
    remoteOptions: uniqueSorted(jobs.map((j) => j.remoteOption)),
    feeTypes: uniqueSorted(jobs.map((j) => j.feeType)),
    guarantees: uniqueSorted(jobs.map((j) => j.guaranteeLabel ?? j.guarantee)),
  };
}

function jobHaystack(job: NetworkJobListing, internalView: boolean): string {
  const parts = [
    job.positionTitle,
    job.companyName,
    job.agencyName,
    job.location,
    job.city,
    job.state,
    job.description,
    ...(internalView ? [job.recruiterNotes] : []),
    job.recruiter?.name,
    job.salary,
    ...job.industries,
    networkSourceChannelCode(job.source),
  ];
  if (internalView) {
    parts.push(
      job.networkId,
      job.fee,
      job.feeType,
      job.guarantee,
      job.guaranteeLabel,
      job.networkStatus,
      job.networkStatusLabel,
      job.recruiter?.agencyName,
      job.recruiter?.externalId
    );
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function matchesSearchTerms(haystack: string, query: string): boolean {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (!terms.length) return true;
  return terms.every((term) => haystack.includes(term));
}

function matchesList(values: string[], haystack: string): boolean {
  if (!values.length) return true;
  return values.some((v) => haystack.includes(v.toLowerCase()));
}

function matchesContains(value: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (!value) return false;
  return value.toLowerCase().includes(q);
}

function parseNumberInput(value: string): number | null {
  const n = Number(value.trim());
  return value.trim() && !Number.isNaN(n) ? n : null;
}

/** Staff-only fields that still hard-hide non-matching rows when set. */
function passesInternalHardFilters(
  job: NetworkJobListing,
  form: NetworkJobFilterForm,
): boolean {
  if (!matchesContains(job.networkStatusLabel ?? job.networkStatus, form.networkStatus)) return false;
  if (!matchesContains(job.feeType, form.feeType)) return false;

  if (form.feeQuery.trim()) {
    const q = form.feeQuery.trim().toLowerCase();
    if (!(job.fee ?? "").toLowerCase().includes(q)) return false;
  }

  if (form.guaranteeQuery.trim()) {
    const q = form.guaranteeQuery.trim().toLowerCase();
    const guaranteeHay = [job.guarantee, job.guaranteeLabel].filter(Boolean).join(" ").toLowerCase();
    if (!guaranteeHay.includes(q)) return false;
  }

  return true;
}

/** Preference boosts for sorting — never hide rows (except explicit search / staff hard filters). */
function computeNetworkJobPreferenceScore(
  job: NetworkJobListing,
  form: NetworkJobFilterForm,
  internalView: boolean,
): number {
  let score = 0;
  const hay = jobHaystack(job, internalView);

  if (form.channel.trim()) {
    const want = form.channel.trim().toUpperCase();
    score +=
      networkSourceChannelCode(job.source).toUpperCase() === want ? 40 : 0;
  }

  const titles = splitInputList(form.jobTitles);
  if (titles.length) {
    const titleHay = (job.positionTitle ?? "").toLowerCase();
    if (titles.some((t) => titleHay.includes(t.toLowerCase()))) score += 24;
  }

  if (matchesList(splitInputList(form.keywords), hay)) score += 16;

  if (form.companyName.trim()) {
    const q = form.companyName.trim().toLowerCase();
    const companyHay = [job.companyName, job.agencyName].filter(Boolean).join(" ").toLowerCase();
    if (companyHay.includes(q)) score += 12;
  }

  if (form.agencyName.trim()) {
    const q = form.agencyName.trim().toLowerCase();
    const agencyHay = [job.agencyName, job.recruiter?.agencyName].filter(Boolean).join(" ").toLowerCase();
    if (agencyHay.includes(q)) score += 12;
  }

  const industryTerms = splitInputList(form.industries);
  if (industryTerms.length) {
    const industryHay = job.industries.join(" ").toLowerCase();
    if (industryTerms.some((t) => industryHay.includes(t.toLowerCase()))) score += 10;
  }

  if (form.locationCity.trim()) {
    const q = form.locationCity.trim().toLowerCase();
    const locHay = [job.city, job.location].filter(Boolean).join(" ").toLowerCase();
    if (locHay.includes(q)) score += 14;
  }

  if (form.locationState.trim()) {
    const q = form.locationState.trim().toLowerCase();
    const locHay = [job.state, job.location].filter(Boolean).join(" ").toLowerCase();
    if (locHay.includes(q)) score += 10;
  }

  if (form.sharedAfter.trim() && job.sharedAt) {
    const shared = new Date(job.sharedAt);
    const from = new Date(form.sharedAfter);
    if (!Number.isNaN(shared.getTime()) && !Number.isNaN(from.getTime()) && shared >= from) {
      score += 8;
    }
  }

  const salaryFrom = parseNumberInput(form.salaryFrom);
  const salaryTo = parseNumberInput(form.salaryTo);
  const compTop = job.compensationMax ?? job.compensationMin;
  const compBottom = job.compensationMin ?? job.compensationMax;
  if (salaryFrom != null && compTop != null && compTop >= salaryFrom) score += 6;
  if (salaryTo != null && compBottom != null && compBottom <= salaryTo) score += 6;

  if (form.jobType.trim() && matchesContains(job.jobType, form.jobType)) score += 6;
  if (form.remoteOption.trim() && matchesContains(job.remoteOption, form.remoteOption)) score += 6;

  return score;
}

export function hasNetworkPreferenceFilters(
  form: NetworkJobFilterForm,
  internalView: boolean,
): boolean {
  return countActiveNetworkFilterFields(form, internalView) > 0 && !form.search.trim();
}

/**
 * Show every in-network role. Profile/filter fields boost sort order; only the search box
 * (and staff-only fee/status fields) hard-hide rows — same spirit as Open Roles defaults.
 */
export function rankNetworkJobsFromForm<T extends NetworkJobListing & { matchScore?: number }>(
  jobs: T[],
  form: NetworkJobFilterForm,
  options?: { internalView?: boolean },
): T[] {
  const internalView = options?.internalView ?? false;
  const hasHardSearch = Boolean(form.search.trim());

  return [...jobs]
    .filter((job) => {
      if (hasHardSearch && !matchesSearchTerms(jobHaystack(job, internalView), form.search)) {
        return false;
      }
      if (internalView && !passesInternalHardFilters(job, form)) return false;
      return true;
    })
    .sort((a, b) => {
      const prefDelta =
        computeNetworkJobPreferenceScore(b, form, internalView) -
        computeNetworkJobPreferenceScore(a, form, internalView);
      if (prefDelta !== 0) return prefDelta;

      const fitDelta = (b.matchScore ?? 0) - (a.matchScore ?? 0);
      if (fitDelta !== 0) return fitDelta;

      const sharedA = a.sharedAt ? new Date(a.sharedAt).getTime() : 0;
      const sharedB = b.sharedAt ? new Date(b.sharedAt).getTime() : 0;
      return sharedB - sharedA;
    });
}

/** @deprecated Prefer rankNetworkJobsFromForm — hard filters hide non-matching roles. */
export function filterNetworkJobsFromForm<T extends NetworkJobListing>(
  jobs: T[],
  form: NetworkJobFilterForm,
  options?: { internalView?: boolean }
): T[] {
  const internalView = options?.internalView ?? false;

  return jobs.filter((job) => {
    const hay = jobHaystack(job, internalView);

    if (!matchesSearchTerms(hay, form.search)) return false;

    const titles = splitInputList(form.jobTitles);
    if (titles.length) {
      const titleHay = (job.positionTitle ?? "").toLowerCase();
      if (!titles.some((t) => titleHay.includes(t.toLowerCase()))) return false;
    }

    if (!matchesList(splitInputList(form.keywords), hay)) return false;

    if (form.companyName.trim()) {
      const q = form.companyName.trim().toLowerCase();
      const companyHay = [job.companyName, job.agencyName].filter(Boolean).join(" ").toLowerCase();
      if (!companyHay.includes(q)) return false;
    }

    if (form.agencyName.trim()) {
      const q = form.agencyName.trim().toLowerCase();
      const agencyHay = [job.agencyName, job.recruiter?.agencyName].filter(Boolean).join(" ").toLowerCase();
      if (!agencyHay.includes(q)) return false;
    }

    const industryTerms = splitInputList(form.industries);
    if (industryTerms.length) {
      const industryHay = job.industries.join(" ").toLowerCase();
      if (!industryTerms.some((t) => industryHay.includes(t.toLowerCase()))) return false;
    }

    if (form.locationCity.trim()) {
      const q = form.locationCity.trim().toLowerCase();
      if (!(job.city ?? job.location ?? "").toLowerCase().includes(q)) return false;
    }

    if (form.locationState.trim()) {
      const q = form.locationState.trim().toLowerCase();
      if (!(job.state ?? job.location ?? "").toLowerCase().includes(q)) return false;
    }

    if (form.sharedAfter.trim() && job.sharedAt) {
      const shared = new Date(job.sharedAt);
      const from = new Date(form.sharedAfter);
      if (!Number.isNaN(shared.getTime()) && !Number.isNaN(from.getTime()) && shared < from) return false;
    } else if (form.sharedAfter.trim() && !job.sharedAt) {
      return false;
    }

    const salaryFrom = parseNumberInput(form.salaryFrom);
    const salaryTo = parseNumberInput(form.salaryTo);
    const compTop = job.compensationMax ?? job.compensationMin;
    const compBottom = job.compensationMin ?? job.compensationMax;
    if (salaryFrom != null && compTop != null && compTop < salaryFrom) return false;
    if (salaryTo != null && compBottom != null && compBottom > salaryTo) return false;

    if (!matchesContains(job.jobType, form.jobType)) return false;
    if (!matchesContains(job.remoteOption, form.remoteOption)) return false;

    if (form.channel.trim()) {
      const want = form.channel.trim().toUpperCase();
      if (networkSourceChannelCode(job.source).toUpperCase() !== want) return false;
    }

    if (internalView) {
      if (!matchesContains(job.networkStatusLabel ?? job.networkStatus, form.networkStatus)) return false;
      if (!matchesContains(job.feeType, form.feeType)) return false;

      if (form.feeQuery.trim()) {
        const q = form.feeQuery.trim().toLowerCase();
        if (!(job.fee ?? "").toLowerCase().includes(q)) return false;
      }

      if (form.guaranteeQuery.trim()) {
        const q = form.guaranteeQuery.trim().toLowerCase();
        const guaranteeHay = [job.guarantee, job.guaranteeLabel].filter(Boolean).join(" ").toLowerCase();
        if (!guaranteeHay.includes(q)) return false;
      }
    }

    return true;
  });
}

export function countActiveNetworkFilterFields(form: NetworkJobFilterForm, internalView: boolean): number {
  let n = 0;
  const textFields: (keyof NetworkJobFilterForm)[] = [
    "search",
    "jobTitles",
    "keywords",
    "companyName",
    "agencyName",
    "industries",
    "locationCity",
    "locationState",
    "sharedAfter",
    "salaryFrom",
    "salaryTo",
    "jobType",
    "remoteOption",
    "channel",
  ];
  for (const key of textFields) {
    if (form[key].trim()) n += 1;
  }

  if (internalView) {
    if (form.networkStatus.trim()) n += 1;
    if (form.feeType.trim()) n += 1;
    if (form.feeQuery.trim()) n += 1;
    if (form.guaranteeQuery.trim()) n += 1;
  }

  return n;
}

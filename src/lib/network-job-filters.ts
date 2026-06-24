import type { CompensationBand } from "@/lib/network-job-format";
import { COMPENSATION_BAND_LABELS } from "@/lib/network-job-format";
import type { NetworkJobListing } from "@/lib/network-job-display";

function splitInputList(value: string): string[] {
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

export type NetworkJobFilterForm = {
  search: string;
  jobTitles: string;
  keywords: string;
  companyName: string;
  industries: string;
  locationCity: string;
  locationState: string;
  sharedAfter: string;
  salaryFrom: string;
  salaryTo: string;
  feeQuery: string;
  guaranteeQuery: string;
  networkStatuses: Set<string>;
  jobTypes: Set<string>;
  remoteOptions: Set<string>;
  compensationBands: Set<CompensationBand>;
  feeTypes: Set<string>;
  guarantees: Set<string>;
  agencies: Set<string>;
};

export function createEmptyNetworkJobFilterForm(): NetworkJobFilterForm {
  return {
    search: "",
    jobTitles: "",
    keywords: "",
    companyName: "",
    industries: "",
    locationCity: "",
    locationState: "",
    sharedAfter: "",
    salaryFrom: "",
    salaryTo: "",
    feeQuery: "",
    guaranteeQuery: "",
    networkStatuses: new Set(),
    jobTypes: new Set(),
    remoteOptions: new Set(),
    compensationBands: new Set(),
    feeTypes: new Set(),
    guarantees: new Set(),
    agencies: new Set(),
  };
}

/** @deprecated use createEmptyNetworkJobFilterForm() */
export const EMPTY_NETWORK_JOB_FILTER_FORM: NetworkJobFilterForm = createEmptyNetworkJobFilterForm();

export type NetworkJobFilterSuggestions = {
  companies: string[];
  industries: string[];
  cities: string[];
  states: string[];
  statuses: string[];
  jobTypes: string[];
  remoteOptions: string[];
  compensationBands: CompensationBand[];
  feeTypes: string[];
  guarantees: string[];
  agencies: string[];
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function buildNetworkJobFilterSuggestions(jobs: NetworkJobListing[]): NetworkJobFilterSuggestions {
  return {
    companies: uniqueSorted(jobs.map((j) => j.companyName)),
    industries: uniqueSorted(jobs.flatMap((j) => j.industries)),
    cities: uniqueSorted(jobs.map((j) => j.city)),
    states: uniqueSorted(jobs.map((j) => j.state)),
    statuses: uniqueSorted(jobs.map((j) => j.networkStatusLabel ?? j.networkStatus)),
    jobTypes: uniqueSorted(jobs.map((j) => j.jobType)),
    remoteOptions: uniqueSorted(jobs.map((j) => j.remoteOption)),
    compensationBands: uniqueSorted(
      jobs.map((j) => j.compensationBand).filter(Boolean) as CompensationBand[]
    ) as CompensationBand[],
    feeTypes: uniqueSorted(jobs.map((j) => j.feeType)),
    guarantees: uniqueSorted(jobs.map((j) => j.guaranteeLabel ?? j.guarantee)),
    agencies: uniqueSorted(jobs.map((j) => j.recruiter?.agencyName)),
  };
}

function jobHaystack(job: NetworkJobListing, internalView: boolean): string {
  const parts = [
    job.positionTitle,
    job.companyName,
    job.location,
    job.city,
    job.state,
    job.description,
    job.recruiterNotes,
    job.recruiter?.name,
    job.salary,
    ...job.industries,
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

function matchesSet<T extends string>(selected: Set<T>, value: string | null | undefined): boolean {
  if (selected.size === 0) return true;
  if (!value) return false;
  return selected.has(value as T);
}

function parseNumberInput(value: string): number | null {
  const n = Number(value.trim());
  return value.trim() && !Number.isNaN(n) ? n : null;
}

export function filterNetworkJobsFromForm(
  jobs: NetworkJobListing[],
  form: NetworkJobFilterForm,
  options?: { internalView?: boolean }
): NetworkJobListing[] {
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
      const companyHay = [job.companyName, job.recruiter?.agencyName].filter(Boolean).join(" ").toLowerCase();
      if (!companyHay.includes(q)) return false;
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

    if (!matchesSet(form.jobTypes, job.jobType)) return false;
    if (!matchesSet(form.remoteOptions, job.remoteOption)) return false;
    if (!matchesSet(form.compensationBands, job.compensationBand)) return false;

    if (internalView) {
      if (!matchesSet(form.networkStatuses, job.networkStatusLabel ?? job.networkStatus)) return false;
      if (!matchesSet(form.agencies, job.recruiter?.agencyName ?? null)) return false;
      if (!matchesSet(form.feeTypes, job.feeType)) return false;
      if (!matchesSet(form.guarantees, job.guaranteeLabel ?? job.guarantee)) return false;

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
  if (form.search.trim()) n += 1;
  if (form.jobTitles.trim()) n += 1;
  if (form.keywords.trim()) n += 1;
  if (form.companyName.trim()) n += 1;
  if (form.industries.trim()) n += 1;
  if (form.locationCity.trim()) n += 1;
  if (form.locationState.trim()) n += 1;
  if (form.sharedAfter.trim()) n += 1;
  if (form.salaryFrom.trim()) n += 1;
  if (form.salaryTo.trim()) n += 1;
  n += form.jobTypes.size;
  n += form.remoteOptions.size;
  n += form.compensationBands.size;

  if (internalView) {
    n += form.networkStatuses.size;
    n += form.agencies.size;
    n += form.feeTypes.size;
    n += form.guarantees.size;
    if (form.feeQuery.trim()) n += 1;
    if (form.guaranteeQuery.trim()) n += 1;
  }

  return n;
}

export function toggleFilterSet<T extends string>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export { COMPENSATION_BAND_LABELS };

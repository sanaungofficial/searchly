import type { CompensationBand } from "@/lib/network-job-format";
import type { NetworkJobListing } from "@/lib/network-job-display";

export type NetworkJobFilters = {
  search: string;
  locations: string[];
  industries: string[];
  statuses: string[];
  jobTypes: string[];
  remoteOptions: string[];
  compensationBands: CompensationBand[];
  agencies: string[];
};

export const EMPTY_NETWORK_JOB_FILTERS: NetworkJobFilters = {
  search: "",
  locations: [],
  industries: [],
  statuses: [],
  jobTypes: [],
  remoteOptions: [],
  compensationBands: [],
  agencies: [],
};

export type NetworkJobFilterOptions = {
  locations: string[];
  industries: string[];
  statuses: string[];
  jobTypes: string[];
  remoteOptions: string[];
  compensationBands: CompensationBand[];
  agencies: string[];
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function buildNetworkJobFilterOptions(jobs: NetworkJobListing[]): NetworkJobFilterOptions {
  return {
    locations: uniqueSorted(jobs.map((j) => j.location)),
    industries: uniqueSorted(jobs.flatMap((j) => j.industries)),
    statuses: uniqueSorted(jobs.map((j) => j.networkStatusLabel ?? j.networkStatus)),
    jobTypes: uniqueSorted(jobs.map((j) => j.jobType)),
    remoteOptions: uniqueSorted(jobs.map((j) => j.remoteOption)),
    compensationBands: uniqueSorted(
      jobs.map((j) => j.compensationBand).filter(Boolean) as CompensationBand[]
    ) as CompensationBand[],
    agencies: uniqueSorted(jobs.map((j) => j.recruiter?.agencyName)),
  };
}

function matchesSearch(job: NetworkJobListing, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    job.positionTitle,
    job.companyName,
    job.location,
    job.networkId,
    job.description,
    job.recruiterNotes,
    job.recruiter?.name,
    job.recruiter?.agencyName,
    ...job.industries,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function matchesMulti(value: string | null | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  if (!value) return false;
  return selected.includes(value);
}

export function filterNetworkJobs(jobs: NetworkJobListing[], filters: NetworkJobFilters): NetworkJobListing[] {
  return jobs.filter((job) => {
    if (!matchesSearch(job, filters.search)) return false;
    if (!matchesMulti(job.location, filters.locations)) return false;
    if (filters.industries.length > 0 && !job.industries.some((i) => filters.industries.includes(i))) return false;
    if (!matchesMulti(job.networkStatusLabel ?? job.networkStatus, filters.statuses)) return false;
    if (!matchesMulti(job.jobType, filters.jobTypes)) return false;
    if (!matchesMulti(job.remoteOption, filters.remoteOptions)) return false;
    if (
      filters.compensationBands.length > 0 &&
      (!job.compensationBand || !filters.compensationBands.includes(job.compensationBand))
    ) {
      return false;
    }
    if (!matchesMulti(job.recruiter?.agencyName ?? null, filters.agencies)) return false;
    return true;
  });
}

export function countActiveNetworkFilters(filters: NetworkJobFilters): number {
  let n = 0;
  if (filters.search.trim()) n += 1;
  n += filters.locations.length;
  n += filters.industries.length;
  n += filters.statuses.length;
  n += filters.jobTypes.length;
  n += filters.remoteOptions.length;
  n += filters.compensationBands.length;
  n += filters.agencies.length;
  return n;
}

export function toggleFilterValue<T extends string>(current: T[], value: T): T[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

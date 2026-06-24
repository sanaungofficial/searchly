import { prisma } from "@/lib/prisma";
import type { HirebaseJob } from "@/lib/hirebase";
import { fetchHirebaseRoleMatchingJobs } from "@/lib/hirebase";
import type { CachedJob } from "@/lib/cached-job";
import { normalizeJobUrl } from "@/lib/cached-job";
import { parseJobsCache } from "@/lib/company-jobs-scan";
import { buildMatchRoles, filterMatchingJobs } from "@/lib/job-match";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";

export type RecommendedJobSource = {
  cached: CachedJob;
  companyName: string;
  raw: HirebaseJob;
};

export function cachedJobToHirebaseJob(job: CachedJob, companyName: string): HirebaseJob {
  return {
    _id: job.hirebaseId ?? undefined,
    job_title: job.title,
    company_name: companyName,
    application_link: job.url ?? undefined,
    requirements_summary: job.jobSummary ?? undefined,
    description: job.description ?? undefined,
    skills: job.skills,
    technologies: job.technologies,
    experience_level: job.seniority ?? job.experienceLevel ?? undefined,
    job_categories: job.tags,
    job_type: job.jobType ?? undefined,
    location_type: job.remote === true ? "Remote" : job.remote === false ? "In-Person" : undefined,
  };
}

/** Same matching roles shown on Companies — from tracked company job caches. */
export async function loadTrackedCompanyMatchJobs(
  userId: string,
  profileTargetRoles: string[],
  maxJobs: number,
): Promise<RecommendedJobSource[]> {
  const tracked = await prisma.trackedCompany.findMany({
    where: { userId },
    select: { name: true, targetRoles: true, jobsCache: true },
    orderBy: { updatedAt: "desc" },
  });

  const out: RecommendedJobSource[] = [];

  for (const company of tracked) {
    const cache = parseJobsCache(company.jobsCache);
    if (!cache?.jobs?.length) continue;

    const matchRoles = buildMatchRoles(profileTargetRoles, company.targetRoles);
    const matched = filterMatchingJobs(cache.jobs, matchRoles, maxJobs);
    for (const job of matched) {
      out.push({
        cached: job,
        companyName: company.name,
        raw: cachedJobToHirebaseJob(job, company.name),
      });
    }
  }

  const seen = new Set<string>();
  return out.filter((entry) => {
    const key = normalizeJobUrl(entry.cached.url) ?? entry.cached.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeJobSources(
  tracked: RecommendedJobSource[],
  global: RecommendedJobSource[],
  maxJobs: number,
): RecommendedJobSource[] {
  const seen = new Set<string>();
  const merged: RecommendedJobSource[] = [];

  for (const entry of [...tracked, ...global]) {
    const key = normalizeJobUrl(entry.cached.url) ?? entry.cached.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
    if (merged.length >= maxJobs) break;
  }

  return merged;
}

/** Role-based Hirebase search — same primitives as Companies matching, not resume embed. */
export async function fetchRecommendedJobsViaRoleMatch(input: {
  userId: string;
  profileTargetRoles: string[];
  filters: VectorSearchFilters;
  semanticQuery?: string;
}): Promise<{
  sources: RecommendedJobSource[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const limit = Math.min(input.filters.limit ?? VECTOR_SEARCH_RESULTS_MAX, VECTOR_SEARCH_RESULTS_MAX);
  const page = Math.max(1, input.filters.page ?? 1);
  const matchRoles =
    input.filters.jobTitles?.length
      ? input.filters.jobTitles.slice(0, 20)
      : input.profileTargetRoles.slice(0, 20);

  const tracked = await loadTrackedCompanyMatchJobs(input.userId, matchRoles, limit);

  let global: RecommendedJobSource[] = [];
  if (matchRoles.length) {
    const search = await fetchHirebaseRoleMatchingJobs({
      matchRoles,
      semanticQuery: input.semanticQuery,
      filters: { ...input.filters, limit, page },
    });
    global = search.jobs.map((cached, index) => ({
      cached,
      companyName: search.companyNames[index] ?? "Unknown company",
      raw: search.rawJobs[index] ?? cachedJobToHirebaseJob(cached, search.companyNames[index] ?? "Unknown company"),
    }));
  }

  const sources = mergeJobSources(tracked, global, limit);

  if (!sources.length) {
    return { sources: [], totalCount: 0, page, limit, totalPages: 0 };
  }

  const totalCount = Math.max(tracked.length + (matchRoles.length ? limit : 0), sources.length);
  return {
    sources,
    totalCount,
    page,
    limit,
    totalPages: 1,
  };
}

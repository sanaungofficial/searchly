import { prisma } from "@/lib/prisma";
import type { HirebaseJob } from "@/lib/hirebase";
import { fetchHirebaseMatchingJobs, fetchHirebaseSummarySearch } from "@/lib/hirebase";
import type { CachedJob } from "@/lib/cached-job";
import { normalizeJobUrl } from "@/lib/cached-job";
import { parseJobsCache } from "@/lib/company-jobs-scan";
import { getHirebaseMetaFromEnrichment } from "@/lib/hirebase-company-sync";
import { buildMatchRoles, filterMatchingJobs } from "@/lib/job-match";
import { applyListingFiltersToSources, jobMatchesListingFilters } from "@/lib/job-listing-filters";
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

function dedupeSources(sources: RecommendedJobSource[], maxJobs: number): RecommendedJobSource[] {
  const seen = new Set<string>();
  const out: RecommendedJobSource[] = [];
  for (const entry of sources) {
    const key = normalizeJobUrl(entry.cached.url) ?? `${entry.companyName}:${entry.cached.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length >= maxJobs) break;
  }
  return out;
}

function jobsFromCache(
  cache: ReturnType<typeof parseJobsCache>,
  companyName: string,
  matchRoles: string[],
  maxJobs: number,
  filters?: VectorSearchFilters,
): RecommendedJobSource[] {
  if (!cache?.jobs?.length) return [];
  let jobs = cache.match_only
    ? cache.jobs.slice(0, maxJobs * 3)
    : filterMatchingJobs(cache.jobs, matchRoles, maxJobs * 3);
  if (filters) {
    jobs = jobs.filter((job) => jobMatchesListingFilters(job, companyName, filters));
  }
  jobs = jobs.slice(0, maxJobs);
  return jobs.map((job) => ({
    cached: job,
    companyName,
    raw: cachedJobToHirebaseJob(job, companyName),
  }));
}

async function liveCompanyMatches(input: {
  companyName: string;
  slugHint: string | null;
  hirebaseSlug: string | null;
  website: string | null;
  matchRoles: string[];
  maxJobs: number;
  filters?: VectorSearchFilters;
  extraKeywords?: string[];
}): Promise<RecommendedJobSource[]> {
  if (!input.matchRoles.length) return [];
  try {
    const result = await fetchHirebaseMatchingJobs({
      companyName: input.companyName,
      slugHint: input.slugHint,
      hirebaseSlug: input.hirebaseSlug,
      website: input.website,
      jobTitles: input.matchRoles,
      extraKeywords: input.extraKeywords,
      maxJobs: input.maxJobs,
      filters: input.filters,
    });
    let matched = filterMatchingJobs(result.jobs, input.matchRoles, input.maxJobs);
    if (input.filters) {
      matched = matched.filter((job) =>
        jobMatchesListingFilters(job, input.companyName, input.filters!),
      );
    }
    return matched.map((job) => ({
      cached: job,
      companyName: input.companyName,
      raw: cachedJobToHirebaseJob(job, input.companyName),
    }));
  } catch {
    return [];
  }
}

/**
 * Recommended jobs = matching roles at tracked companies only (same path as Companies drawer).
 * Never uses resume embed. Uses cached scan results, live Hirebase fetch per company if cache empty.
 */
export async function fetchRecommendedFromTrackedCompanies(input: {
  userId: string;
  profileTargetRoles: string[];
  filters?: VectorSearchFilters;
  maxJobs?: number;
  /** When true, only use stored company job caches — skip live Hirebase fetches. */
  preferCache?: boolean;
}): Promise<{
  sources: RecommendedJobSource[];
  companyCount: number;
  trackedWithMatches: number;
}> {
  const maxJobs = Math.min(input.maxJobs ?? VECTOR_SEARCH_RESULTS_MAX, VECTOR_SEARCH_RESULTS_MAX);
  const filters = input.filters;
  const roleBase = filters?.jobTitles?.length
    ? filters.jobTitles.slice(0, 20)
    : input.profileTargetRoles;

  let tracked = await prisma.trackedCompany.findMany({
    where: { userId: input.userId },
    include: { companyIntel: true },
    orderBy: { updatedAt: "desc" },
  });

  if (filters?.companyName?.trim()) {
    const q = filters.companyName.trim().toLowerCase();
    tracked = tracked.filter((c) => (c.companyIntel?.name ?? c.name).toLowerCase().includes(q));
  }

  if (!tracked.length) {
    return { sources: [], companyCount: 0, trackedWithMatches: 0 };
  }

  const extraKeywords = filters?.keywords ?? [];
  const perCompanyLimit = Math.max(3, Math.ceil(maxJobs / Math.max(tracked.length, 1)));
  const collected: RecommendedJobSource[] = [];

  for (const company of tracked) {
    const matchRoles = buildMatchRoles(roleBase, company.targetRoles);
    if (!matchRoles.length && !filters?.keywords?.length) continue;

    const companyName = company.companyIntel?.name ?? company.name;
    const cache = parseJobsCache(company.jobsCache);
    let sources = jobsFromCache(cache, companyName, matchRoles, perCompanyLimit, filters);

    if (!sources.length && matchRoles.length && !input.preferCache) {
      const enrichment = company.companyIntel?.enrichmentCache ?? company.enrichmentCache;
      const hirebaseMeta = getHirebaseMetaFromEnrichment(enrichment);
      sources = await liveCompanyMatches({
        companyName,
        slugHint: company.companyIntel?.slug ?? null,
        hirebaseSlug: hirebaseMeta?.slug ?? null,
        website: company.website ?? company.companyIntel?.website ?? null,
        matchRoles,
        maxJobs: perCompanyLimit,
        filters,
        extraKeywords,
      });
    }

    collected.push(...sources);
  }

  const sources = applyListingFiltersToSources(dedupeSources(collected, maxJobs), filters);
  const trackedWithMatches = new Set(sources.map((s) => s.companyName)).size;

  return {
    sources,
    companyCount: tracked.length,
    trackedWithMatches,
  };
}

/** Keyword search scoped to tracked companies — not resume-based. */
export async function fetchSemanticSearchOnTrackedCompanies(input: {
  userId: string;
  profileTargetRoles: string[];
  query: string;
  filters: VectorSearchFilters;
}): Promise<{
  sources: RecommendedJobSource[];
  scoped: boolean;
}> {
  const query = input.query.trim();
  if (!query) {
    return { sources: [], scoped: true };
  }

  const limit = Math.min(input.filters.limit ?? VECTOR_SEARCH_RESULTS_MAX, VECTOR_SEARCH_RESULTS_MAX);
  const tracked = await prisma.trackedCompany.findMany({
    where: { userId: input.userId },
    include: { companyIntel: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!tracked.length) {
    const summary = await fetchHirebaseSummarySearch({
      query,
      filters: { ...input.filters, limit, page: input.filters.page ?? 1 },
    });
    return {
      sources: summary.jobs.map((cached, index) => ({
        cached,
        companyName: summary.companyNames[index] ?? "Unknown company",
        raw: summary.rawJobs[index] ?? cachedJobToHirebaseJob(cached, summary.companyNames[index] ?? "Unknown company"),
      })),
      scoped: false,
    };
  }

  const perCompanyLimit = Math.max(3, Math.ceil(limit / Math.max(tracked.length, 1)));
  const collected: RecommendedJobSource[] = [];

  for (const company of tracked) {
    const matchRoles = buildMatchRoles(input.profileTargetRoles, company.targetRoles);
    const searchRoles = matchRoles.length ? matchRoles : [query];
    const companyName = company.companyIntel?.name ?? company.name;
    const enrichment = company.companyIntel?.enrichmentCache ?? company.enrichmentCache;
    const hirebaseMeta = getHirebaseMetaFromEnrichment(enrichment);

    try {
      const result = await fetchHirebaseMatchingJobs({
        companyName,
        slugHint: company.companyIntel?.slug ?? null,
        hirebaseSlug: hirebaseMeta?.slug ?? null,
        website: company.website ?? company.companyIntel?.website ?? null,
        jobTitles: searchRoles,
        extraKeywords: query.split(/\s+/).filter((w) => w.length >= 3),
        maxJobs: perCompanyLimit,
      });
      for (const job of result.jobs) {
        collected.push({
          cached: job,
          companyName,
          raw: cachedJobToHirebaseJob(job, companyName),
        });
      }
    } catch {
      continue;
    }
  }

  return {
    sources: applyListingFiltersToSources(dedupeSources(collected, limit), input.filters),
    scoped: true,
  };
}

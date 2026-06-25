import { prisma } from "@/lib/prisma";
import type { HirebaseJob } from "@/lib/hirebase";
import {
  fetchHirebaseMatchingJobs,
  fetchHirebaseRoleMatchingJobs,
  fetchHirebaseSummarySearch,
  fetchHirebaseVectorJobs,
  mapHirebaseJob,
} from "@/lib/hirebase";
import type { CachedJob } from "@/lib/cached-job";
import { normalizeJobUrl } from "@/lib/cached-job";
import { parseJobsCache } from "@/lib/company-jobs-scan";
import { getHirebaseMetaFromEnrichment } from "@/lib/hirebase-company-sync";
import { buildMatchRoles, filterMatchingJobs } from "@/lib/job-match";
import { applyListingFiltersToSources, jobMatchesListingFilters } from "@/lib/job-listing-filters";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { RECOMMENDED_FETCH_POOL } from "@/lib/recommended-jobs-config";

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
  const maxJobs = Math.min(input.maxJobs ?? RECOMMENDED_FETCH_POOL, RECOMMENDED_FETCH_POOL);
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

function normalizeCompanyKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

type TrackedCompanyRow = Awaited<ReturnType<typeof prisma.trackedCompany.findMany>>[number] & {
  companyIntel?: { name?: string; slug?: string | null; enrichmentCache?: unknown } | null;
};

export function buildTrackedCompanyIndex(companies: TrackedCompanyRow[]) {
  const names = new Set<string>();
  const slugs = new Set<string>();
  for (const company of companies) {
    const name = company.companyIntel?.name ?? company.name;
    if (name?.trim()) names.add(normalizeCompanyKey(name));
    const enrichment = company.companyIntel?.enrichmentCache ?? company.enrichmentCache;
    const hirebaseMeta = getHirebaseMetaFromEnrichment(enrichment);
    const slug = (hirebaseMeta?.slug ?? company.companyIntel?.slug)?.trim().toLowerCase();
    if (slug) slugs.add(slug);
  }
  return { names, slugs };
}

export function jobMatchesTrackedCompany(job: HirebaseJob, index: ReturnType<typeof buildTrackedCompanyIndex>): boolean {
  const jobSlug = job.company_slug?.trim().toLowerCase();
  if (jobSlug && index.slugs.has(jobSlug)) return true;

  const jobName = job.company_name?.trim();
  if (!jobName) return false;
  const key = normalizeCompanyKey(jobName);
  if (index.names.has(key)) return true;

  for (const tracked of index.names) {
    if (key.includes(tracked) || tracked.includes(key)) return true;
  }
  return false;
}

export function companyNameMatchesTracked(
  companyName: string,
  index: ReturnType<typeof buildTrackedCompanyIndex>,
): boolean {
  const key = normalizeCompanyKey(companyName);
  if (index.names.has(key)) return true;
  for (const tracked of index.names) {
    if (key.includes(tracked) || tracked.includes(key)) return true;
  }
  return false;
}

export async function loadTrackedCompanyIndex(userId: string) {
  const tracked = await prisma.trackedCompany.findMany({
    where: { userId },
    include: { companyIntel: true },
    orderBy: { updatedAt: "desc" },
  });
  return { tracked, index: buildTrackedCompanyIndex(tracked) };
}

function buildVSearchFilters(
  profileTargetRoles: string[],
  filters?: VectorSearchFilters,
  semanticQuery?: string,
): { merged: VectorSearchFilters; query?: string } {
  const jobTitles = filters?.jobTitles?.length
    ? filters.jobTitles
    : profileTargetRoles.length
      ? profileTargetRoles
      : undefined;

  const { semanticQuery: _omit, ...rest } = filters ?? {};

  return {
    merged: {
      ...rest,
      jobTitles,
    },
    query: semanticQuery?.trim() || undefined,
  };
}

/**
 * Role-based job search when resume vector match or tracked-company cache is unavailable.
 * Uses Hirebase `/v2/jobs/search` with profile target roles (no resume artifact).
 */
export async function fetchRecommendedFromProfileRoles(input: {
  profileTargetRoles: string[];
  filters?: VectorSearchFilters;
  semanticQuery?: string;
  maxJobs?: number;
}): Promise<{ sources: RecommendedJobSource[] }> {
  const maxJobs = Math.min(input.maxJobs ?? RECOMMENDED_FETCH_POOL, RECOMMENDED_FETCH_POOL);
  const filters = input.filters;
  const roleBase = filters?.jobTitles?.length
    ? filters.jobTitles.slice(0, 20)
    : input.profileTargetRoles;

  const semanticQuery = input.semanticQuery?.trim();
  const matchRoles =
    roleBase.length > 0
      ? roleBase
      : semanticQuery
        ? semanticQuery.split(/\s+/).filter((w) => w.length >= 3).slice(0, 5)
        : [];

  if (!matchRoles.length) {
    return { sources: [] };
  }

  try {
    const result = await fetchHirebaseRoleMatchingJobs({
      matchRoles,
      semanticQuery: semanticQuery || undefined,
      filters: {
        ...filters,
        limit: maxJobs,
        page: filters?.page ?? 1,
      },
    });

    const sources: RecommendedJobSource[] = [];
    for (let i = 0; i < result.rawJobs.length; i++) {
      const raw = result.rawJobs[i];
      const cached = result.jobs[i] ?? mapHirebaseJob(raw);
      const companyName = result.companyNames[i] ?? raw.company_name?.trim() ?? "Unknown company";
      sources.push({ cached, companyName, raw });
      if (sources.length >= maxJobs) break;
    }

    return { sources: applyListingFiltersToSources(sources, filters) };
  } catch {
    return { sources: [] };
  }
}

/**
 * Recommended jobs via Hirebase resume vector search (`POST /v2/jobs/vsearch`, search_type=resume).
 * Global results — watchlist companies get a ranking boost downstream, not a hard filter.
 */
export async function fetchRecommendedViaResumeVSearch(input: {
  userId: string;
  artifactId: string;
  profileTargetRoles: string[];
  filters?: VectorSearchFilters;
  semanticQuery?: string;
  maxJobs?: number;
}): Promise<{
  sources: RecommendedJobSource[];
  companyCount: number;
  trackedWithMatches: number;
}> {
  const maxJobs = Math.min(input.maxJobs ?? RECOMMENDED_FETCH_POOL, RECOMMENDED_FETCH_POOL);

  const { tracked, index: trackedIndex } = await loadTrackedCompanyIndex(input.userId);

  const { merged: vsearchFilters, query } = buildVSearchFilters(
    input.profileTargetRoles,
    input.filters,
    input.semanticQuery,
  );

  const vsearch = await fetchHirebaseVectorJobs({
    artifactId: input.artifactId,
    ...vsearchFilters,
    query,
    limit: maxJobs,
    fetchLimit: Math.min(100, maxJobs),
    page: input.filters?.page ?? 1,
    accuracy: input.filters?.accuracy,
    topK: input.filters?.topK,
    minScore: input.filters?.minScore,
  });

  const sources: RecommendedJobSource[] = [];
  for (let i = 0; i < vsearch.rawJobs.length; i++) {
    const raw = vsearch.rawJobs[i];
    const cached = vsearch.jobs[i] ?? mapHirebaseJob(raw);
    const companyName = raw.company_name?.trim() || vsearch.companyNames[i] || "Unknown company";
    sources.push({ cached, companyName, raw });
    if (sources.length >= maxJobs) break;
  }

  const filtered = applyListingFiltersToSources(sources, input.filters);
  const trackedWithMatches = filtered.filter((s) => jobMatchesTrackedCompany(s.raw, trackedIndex)).length;

  return {
    sources: filtered,
    companyCount: tracked.length,
    trackedWithMatches,
  };
}

/**
 * Profile-based semantic search when no resume artifact (`search_type=summary`).
 */
export async function fetchRecommendedViaProfileSummary(input: {
  userId: string;
  query: string;
  profileTargetRoles: string[];
  filters?: VectorSearchFilters;
  maxJobs?: number;
}): Promise<{
  sources: RecommendedJobSource[];
  companyCount: number;
  trackedWithMatches: number;
}> {
  const maxJobs = Math.min(input.maxJobs ?? RECOMMENDED_FETCH_POOL, RECOMMENDED_FETCH_POOL);
  const { tracked, index: trackedIndex } = await loadTrackedCompanyIndex(input.userId);

  const { merged: vsearchFilters } = buildVSearchFilters(input.profileTargetRoles, input.filters);

  const summary = await fetchHirebaseSummarySearch({
    query: input.query,
    filters: {
      ...vsearchFilters,
      limit: maxJobs,
      page: input.filters?.page ?? 1,
    },
  });

  const sources: RecommendedJobSource[] = summary.rawJobs.map((raw, i) => ({
    cached: summary.jobs[i] ?? mapHirebaseJob(raw),
    companyName: summary.companyNames[i] ?? raw.company_name?.trim() ?? "Unknown company",
    raw,
  }));

  const filtered = applyListingFiltersToSources(sources, input.filters);
  const trackedWithMatches = filtered.filter((s) => jobMatchesTrackedCompany(s.raw, trackedIndex)).length;

  return {
    sources: filtered,
    companyCount: tracked.length,
    trackedWithMatches,
  };
}

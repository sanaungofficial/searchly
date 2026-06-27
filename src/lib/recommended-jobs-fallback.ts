import { prisma } from "@/lib/prisma";
import type { HirebaseJob } from "@/lib/hirebase";
import {
  fetchHirebaseMatchingJobs,
  fetchHirebaseRecentJobs,
  fetchHirebaseRoleMatchingJobs,
  fetchHirebaseSimilarJobs,
  fetchHirebaseSummarySearch,
  fetchHirebaseVectorJobs,
  mapHirebaseJob,
} from "@/lib/hirebase";
import type { CachedJob } from "@/lib/cached-job";
import { jobListingDedupeKey, jobListingUrlDedupeKey, normalizeJobUrl } from "@/lib/cached-job";
import { parseJobsCache } from "@/lib/company-jobs-scan";
import { getHirebaseMetaFromEnrichment } from "@/lib/hirebase-company-sync";
import { buildMatchRoles, filterMatchingJobs } from "@/lib/job-match";
import { applyListingFiltersToSources, jobMatchesListingFilters } from "@/lib/job-listing-filters";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { RECOMMENDED_FETCH_POOL, RECOMMENDED_SIMILAR_JOB_SEED_COUNT } from "@/lib/recommended-jobs-config";
import { resolveExpandedRoleTitles } from "@/lib/expanded-role-titles-cache";
import { profileRoleTitlesForMatch, type RoleTitlePreferences } from "@/lib/role-title-preferences";

export type RecommendedFetchLane =
  | "resume_vsearch"
  | "profile_summary"
  | "profile_roles"
  | "expanded_roles"
  | "similar_job"
  | "tracked"
  | "broad";

export type RecommendedJobSource = {
  cached: CachedJob;
  companyName: string;
  raw: HirebaseJob;
  fetchLane?: RecommendedFetchLane;
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

function lanePriority(lane?: RecommendedFetchLane): number {
  switch (lane) {
    case "resume_vsearch":
      return 1;
    case "profile_summary":
      return 2;
    case "similar_job":
      return 3;
    case "profile_roles":
      return 4;
    case "expanded_roles":
      return 5;
    case "tracked":
      return 6;
    case "broad":
      return 7;
    default:
      return 8;
  }
}

function mergeFetchLane(
  existing?: RecommendedFetchLane,
  next?: RecommendedFetchLane,
): RecommendedFetchLane | undefined {
  if (!existing) return next;
  if (!next) return existing;
  return lanePriority(next) < lanePriority(existing) ? next : existing;
}

export function sourceListingKey(source: RecommendedJobSource): string {
  return jobListingDedupeKey({
    companyName: source.companyName,
    title: source.cached.title,
    url: source.cached.url,
  });
}

export function buildFetchLaneMap(sources: RecommendedJobSource[]): Map<string, RecommendedFetchLane> {
  const map = new Map<string, RecommendedFetchLane>();
  for (const source of sources) {
    if (!source.fetchLane) continue;
    const key = sourceListingKey(source);
    if (!key) continue;
    map.set(key, mergeFetchLane(map.get(key), source.fetchLane) ?? source.fetchLane);
  }
  return map;
}

export function tagSourcesWithLane(
  sources: RecommendedJobSource[],
  fetchLane: RecommendedFetchLane,
): RecommendedJobSource[] {
  return sources.map((source) => ({ ...source, fetchLane: mergeFetchLane(source.fetchLane, fetchLane) }));
}

export function dedupeRecommendedSources(sources: RecommendedJobSource[], maxJobs: number): RecommendedJobSource[] {
  const byKey = new Map<string, RecommendedJobSource>();
  for (const entry of sources) {
    const key =
      jobListingUrlDedupeKey({
        companyName: entry.companyName,
        title: entry.cached.title,
        url: entry.cached.url,
        hirebaseId: entry.cached.hirebaseId,
      }) ||
      (normalizeJobUrl(entry.cached.url) ?? `${entry.companyName}:${entry.cached.title}`.toLowerCase());
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entry);
      continue;
    }
    const existingPosted = existing.cached.datePosted ? Date.parse(existing.cached.datePosted) : 0;
    const nextPosted = entry.cached.datePosted ? Date.parse(entry.cached.datePosted) : 0;
    const keep = nextPosted >= existingPosted ? entry : existing;
    const drop = nextPosted >= existingPosted ? existing : entry;
    byKey.set(key, {
      ...keep,
      fetchLane: mergeFetchLane(keep.fetchLane, drop.fetchLane),
    });
  }
  return [...byKey.values()].slice(0, maxJobs);
}

function hasDisplayKey(keys: Set<string>, source: RecommendedJobSource): boolean {
  const key = jobListingDedupeKey({
    companyName: source.companyName,
    title: source.cached.title,
    url: source.cached.url,
  });
  return keys.has(key);
}

async function fetchRecentJobSources(input: {
  keywords: string[];
  maxJobs: number;
  pages: number[];
  excludeDisplayKeys?: Set<string>;
}): Promise<RecommendedJobSource[]> {
  const perPage = Math.max(10, Math.ceil(input.maxJobs / input.pages.length));
  const collected: RecommendedJobSource[] = [];

  for (const page of input.pages) {
    try {
      const recent = await fetchHirebaseRecentJobs({ keywords: input.keywords, maxJobs: perPage, page });
      for (let i = 0; i < recent.rawJobs.length; i++) {
        const source: RecommendedJobSource = {
          cached: recent.jobs[i] ?? mapHirebaseJob(recent.rawJobs[i]!),
          companyName: recent.companyNames[i] ?? "Unknown company",
          raw: recent.rawJobs[i]!,
        };
        if (input.excludeDisplayKeys?.size && hasDisplayKey(input.excludeDisplayKeys, source)) continue;
        collected.push(source);
      }
    } catch {
      continue;
    }
  }

  return dedupeRecommendedSources(collected, input.maxJobs);
}

function dedupeSources(sources: RecommendedJobSource[], maxJobs: number): RecommendedJobSource[] {
  return dedupeRecommendedSources(sources, maxJobs);
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
 * Watchlist company jobs — supplements the global recommended feed (same scan path as Companies drawer).
 * Never the sole source when target-title search can run.
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

  const sources = tagSourcesWithLane(
    applyListingFiltersToSources(dedupeSources(collected, maxJobs), filters),
    "tracked",
  );
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

/** Exact or prefix match — avoids loose substring hits on short tokens. */
function trackedCompanyNameMatches(jobKey: string, trackedKey: string): boolean {
  if (jobKey === trackedKey) return true;
  const longer = jobKey.length >= trackedKey.length ? jobKey : trackedKey;
  const shorter = jobKey.length >= trackedKey.length ? trackedKey : jobKey;
  if (shorter.length < 4) return false;
  return longer.startsWith(`${shorter} `) || longer.endsWith(` ${shorter}`);
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
    if (trackedCompanyNameMatches(key, tracked)) return true;
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
    if (trackedCompanyNameMatches(key, tracked)) return true;
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

    return { sources: tagSourcesWithLane(applyListingFiltersToSources(sources, filters), "profile_roles") };
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
    sources: tagSourcesWithLane(filtered, "resume_vsearch"),
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
    sources: tagSourcesWithLane(filtered, "profile_summary"),
    companyCount: tracked.length,
    trackedWithMatches,
  };
}

function broadSearchKeywords(profileTargetRoles: string[], semanticQuery?: string): string[] {
  const fromRoles = profileTargetRoles
    .flatMap((role) => role.split(/\s+/))
    .map((w) => w.replace(/[^a-z0-9+#]/gi, "").toLowerCase())
    .filter((w) => w.length >= 4);
  const fromQuery = (semanticQuery ?? "")
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9+#]/gi, "").toLowerCase())
    .filter((w) => w.length >= 4);
  const merged = [...new Set([...fromRoles, ...fromQuery])];
  if (merged.length) return merged.slice(0, 8);
  return ["manager", "director", "analyst"];
}

const DIVERSE_BROAD_KEYWORDS = [
  "manager",
  "director",
  "specialist",
  "coordinator",
  "analyst",
  "representative",
  "consultant",
  "engineer",
];

/**
 * Last-resort feed: recent Hirebase roles with no salary/date/location filters.
 * Ensures Find roles never stays empty when the index has data.
 */
export async function fetchRecommendedBroadFallback(input: {
  profileTargetRoles?: string[];
  semanticQuery?: string;
  maxJobs?: number;
  /** Pull from multiple pages with generic keywords for feed diversity. */
  diverse?: boolean;
  excludeDisplayKeys?: Set<string>;
}): Promise<{ sources: RecommendedJobSource[] }> {
  const maxJobs = Math.min(input.maxJobs ?? RECOMMENDED_FETCH_POOL, RECOMMENDED_FETCH_POOL);
  const keywords = input.diverse
    ? DIVERSE_BROAD_KEYWORDS
    : broadSearchKeywords(input.profileTargetRoles ?? [], input.semanticQuery);
  const pages = input.diverse ? [1, 2, 3] : [1];

  try {
    const recentSources = await fetchRecentJobSources({
      keywords,
      maxJobs,
      pages,
      excludeDisplayKeys: input.excludeDisplayKeys,
    });
    if (recentSources.length) {
      return { sources: tagSourcesWithLane(recentSources, "broad") };
    }
  } catch {
    /* try summary search */
  }

  const query =
    input.semanticQuery?.trim() ||
    (input.profileTargetRoles?.length ? input.profileTargetRoles.slice(0, 3).join(", ") : "recent job openings");

  try {
    const summary = await fetchHirebaseSummarySearch({
      query,
      filters: { limit: maxJobs, page: 1 },
    });
    const sources: RecommendedJobSource[] = [];
    for (let i = 0; i < summary.rawJobs.length; i++) {
      const source: RecommendedJobSource = {
        cached: summary.jobs[i] ?? mapHirebaseJob(summary.rawJobs[i]!),
        companyName: summary.companyNames[i] ?? summary.rawJobs[i]?.company_name?.trim() ?? "Unknown company",
        raw: summary.rawJobs[i]!,
      };
      if (input.excludeDisplayKeys?.size && hasDisplayKey(input.excludeDisplayKeys, source)) continue;
      sources.push(source);
    }
    return { sources: tagSourcesWithLane(dedupeSources(sources, maxJobs), "broad") };
  } catch {
    return { sources: [] };
  }
}

function pickSimilarJobSeedIds(sources: RecommendedJobSource[], maxSeeds: number): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const priority: RecommendedFetchLane[] = ["resume_vsearch", "profile_summary", "profile_roles", "similar_job"];

  const ordered = [...sources].sort((a, b) => {
    const laneA = a.fetchLane ? priority.indexOf(a.fetchLane) : 99;
    const laneB = b.fetchLane ? priority.indexOf(b.fetchLane) : 99;
    return laneA - laneB;
  });

  for (const source of ordered) {
    const id = source.raw._id?.trim() || source.cached.hirebaseId?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= maxSeeds) break;
  }
  return ids;
}

/** Similar roles via Hirebase vsearch (`search_type=job`) — capped seeds per refresh. */
export async function fetchRecommendedFromSimilarJobs(input: {
  seedSources: RecommendedJobSource[];
  filters?: VectorSearchFilters;
  maxJobs?: number;
  maxSeeds?: number;
}): Promise<{ sources: RecommendedJobSource[] }> {
  const maxJobs = Math.min(input.maxJobs ?? RECOMMENDED_FETCH_POOL, RECOMMENDED_FETCH_POOL);
  const seedIds = pickSimilarJobSeedIds(
    input.seedSources,
    input.maxSeeds ?? RECOMMENDED_SIMILAR_JOB_SEED_COUNT,
  );
  if (!seedIds.length) return { sources: [] };

  const perSeed = Math.max(5, Math.ceil(maxJobs / seedIds.length));
  const collected: RecommendedJobSource[] = [];

  for (const jobId of seedIds) {
    try {
      const similar = await fetchHirebaseSimilarJobs({
        jobId,
        filters: {
          ...input.filters,
          limit: perSeed,
          page: input.filters?.page ?? 1,
        },
        limit: perSeed,
      });
      for (let i = 0; i < similar.rawJobs.length; i++) {
        const raw = similar.rawJobs[i]!;
        collected.push({
          cached: similar.jobs[i] ?? mapHirebaseJob(raw),
          companyName: similar.companyNames[i] ?? raw.company_name?.trim() ?? "Unknown company",
          raw,
          fetchLane: "similar_job",
        });
      }
    } catch {
      continue;
    }
  }

  return {
    sources: tagSourcesWithLane(
      applyListingFiltersToSources(dedupeSources(collected, maxJobs), input.filters),
      "similar_job",
    ),
  };
}

/** Target-title family expansion — related roles from Hirebase search API. */
export async function fetchRecommendedFromExpandedRoles(input: {
  userId: string;
  roleTitlePreferences: RoleTitlePreferences;
  filters?: VectorSearchFilters;
  maxJobs?: number;
}): Promise<{ sources: RecommendedJobSource[]; expandedTitles: string[] }> {
  const expandedTitles = await resolveExpandedRoleTitles({
    userId: input.userId,
    roleTitlePreferences: input.roleTitlePreferences,
  });
  const baseTitles = profileRoleTitlesForMatch(input.roleTitlePreferences);
  const extraTitles = expandedTitles.filter(
    (title) => !baseTitles.some((base) => base.toLowerCase() === title.toLowerCase()),
  );
  if (!extraTitles.length) {
    return { sources: [], expandedTitles };
  }

  const result = await fetchRecommendedFromProfileRoles({
    profileTargetRoles: extraTitles,
    filters: input.filters,
    maxJobs: input.maxJobs,
  });

  return {
    sources: tagSourcesWithLane(result.sources, "expanded_roles"),
    expandedTitles,
  };
}

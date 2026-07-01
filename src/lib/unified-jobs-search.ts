import {
  fetchHirebaseNeuralJobs,
  fetchHirebaseRoleMatchingJobs,
  mapHirebaseJob,
  type HirebaseJob,
} from "@/lib/hirebase";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import { sourcesToCacheEntries, upsertJobListingCache } from "@/lib/job-listing-cache";
import { applyListingFiltersToSources } from "@/lib/job-listing-filters";
import { filterSourcesByRadiusMiles } from "@/lib/job-location-radius";
import { normalizePostedDateFilters } from "@/lib/job-posted-filter";
import { extractProfileSkills } from "@/lib/job-fit-ranking";
import { sanitizeFiltersForHirebase } from "@/lib/opportunities-hirebase-filters";
import { applyExclusionPrefsToSources, type ListingExclusionPrefs } from "@/lib/opportunities-exclusion-filters";
import {
  customJobFunctionsToSemanticQuery,
  mergeVSearchQueryParts,
  profileTextForMatchReasons,
  trimVSearchQuery,
} from "@/lib/profile-vsearch-query";
import {
  RECOMMENDED_FETCH_POOL,
  RECOMMENDED_MIN_DISPLAY_ROLES,
  RECOMMENDED_SNAPSHOT_MAX_JOBS,
  type RecommendedMatchMode,
} from "@/lib/recommended-jobs-config";
import {
  buildFetchLaneMap,
  companyNameMatchesTracked,
  dedupeRecommendedSources,
  fetchRecommendedBroadFallback,
  loadTrackedCompanyIndex,
  tagSourcesWithLane,
  type RecommendedJobSource,
} from "@/lib/recommended-jobs-fallback";
import {
  finalizeRecommendedJobs,
  rankRecommendedJobPool,
  splitRecommendedDisplayAndReserve,
} from "@/lib/recommended-jobs-ranking";
import { loadUserPipelineDedupeKeys } from "@/lib/pipeline-job-dedupe";
import { buildRoleTitlePreferencesFromProfile, type RoleTitlePreferences } from "@/lib/role-title-preferences";
import { mergeParsedWithReadback, normalizeParsedResumeData, personalNameMatchTokens } from "@/lib/resume-parse";
import type { VectorMatchedJob, VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { prisma } from "@/lib/prisma";
import { loadFlatIndustryOptions, splitIndustrySelections } from "@/lib/industry-options";
import { hirebaseCompanyTypesFromStages, parseSearchPreferences } from "@/lib/search-preferences";
import { formatProfileLocation } from "@/lib/recommended-filter-utils";

export type UnifiedSearchMode = "recommended" | "search";

export type UnifiedSearchInput = {
  userId: string;
  filters: VectorSearchFilters;
  mode: UnifiedSearchMode;
  maxJobs?: number;
  exclusions?: ListingExclusionPrefs;
};

export type UnifiedSearchResult = {
  jobs: VectorMatchedJob[];
  reserveJobs?: VectorMatchedJob[];
  totalCount: number;
  matchMode: RecommendedMatchMode;
  companyCount: number;
  trackedWithMatches: number;
  notice?: string;
  filtersApplied: VectorSearchFilters;
};

type UserSearchContext = {
  targetRoles: string[];
  resumeText: string;
  roleTitlePreferences: RoleTitlePreferences;
  profileSkills: string[];
  nameMatchExcludeTerms: string[];
  profileLocation: string | null;
};

async function loadUserSearchContext(userId: string): Promise<UserSearchContext> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const roleTitlePreferences = buildRoleTitlePreferencesFromProfile(profile);
  const targetRoles = roleTitlePreferences.targetRoles ?? [];
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );

  const resumeText = profileTextForMatchReasons({
    headline: profile?.headline,
    targetRoles,
    resumeText: profile?.resumeText,
    parsedData,
    careerMotivation: profile?.careerMotivation,
    priorities: profile?.priorities ?? [],
    employmentStatus: profile?.employmentStatus,
    jobTimeline: profile?.jobTimeline,
    targetSalary: profile?.targetSalary
      ? Number.parseFloat(profile.targetSalary.replace(/[^0-9.]/g, "")) || null
      : null,
  });

  return {
    targetRoles,
    resumeText,
    roleTitlePreferences,
    profileSkills: extractProfileSkills(parsedData),
    nameMatchExcludeTerms: personalNameMatchTokens(parsedData),
    profileLocation: parsedData.location ?? null,
  };
}

async function resolveIndustryFilters(filters: VectorSearchFilters): Promise<VectorSearchFilters> {
  const combined = [...(filters.industries ?? []), ...(filters.subindustries ?? [])];
  if (!combined.length) return filters;
  try {
    const catalog = await loadFlatIndustryOptions();
    const split = splitIndustrySelections(combined, catalog);
    return {
      ...filters,
      industries: split.industries.length ? split.industries : undefined,
      subindustries: split.subindustries.length ? split.subindustries : undefined,
    };
  } catch {
    return filters;
  }
}

async function prepareSearchFilters(
  requestFilters: VectorSearchFilters,
  userId: string,
): Promise<VectorSearchFilters> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const searchPreferences = parseSearchPreferences(
    parsedData && typeof parsedData === "object"
      ? (parsedData as { searchPreferences?: unknown }).searchPreferences
      : undefined,
  );

  let merged = normalizePostedDateFilters(
    sanitizeFiltersForHirebase({
      ...requestFilters,
      semanticQuery: trimVSearchQuery(requestFilters.semanticQuery ?? "") || undefined,
    }),
  );

  if (searchPreferences.companyStages?.length && !merged.companyTypes?.length) {
    merged = {
      ...merged,
      companyTypes: hirebaseCompanyTypesFromStages(searchPreferences.companyStages),
    };
  }

  if (searchPreferences.openToAllSalary) {
    delete merged.salaryFrom;
    delete merged.salaryTo;
  }
  if (searchPreferences.openToAllExperience) {
    delete merged.yearsFrom;
    delete merged.yearsTo;
    delete merged.experienceLevels;
  }

  return resolveIndustryFilters(merged);
}

function hirebaseResultToSources(
  rawJobs: HirebaseJob[],
  jobs: ReturnType<typeof mapHirebaseJob>[],
  companyNames: string[],
  lane: RecommendedJobSource["fetchLane"],
  maxJobs: number,
): RecommendedJobSource[] {
  const sources: RecommendedJobSource[] = [];
  for (let i = 0; i < rawJobs.length && sources.length < maxJobs; i++) {
    const raw = rawJobs[i]!;
    const cached = jobs[i] ?? mapHirebaseJob(raw);
    sources.push({
      cached,
      companyName: companyNames[i] ?? raw.company_name?.trim() ?? "Unknown company",
      raw,
      fetchLane: lane,
    });
  }
  return sources;
}

function buildStructuredQuery(
  filters: VectorSearchFilters,
  targetRoles: string[],
): string | undefined {
  return mergeVSearchQueryParts(
    filters.semanticQuery,
    customJobFunctionsToSemanticQuery(filters.customJobFunctions),
    targetRoles.slice(0, 5).join(", "),
    filters.jobCategories?.slice(0, 3).map((c) => c.replace(/ Jobs$/i, "")).join(", "),
  );
}

function matchRolesFromFilters(filters: VectorSearchFilters, targetRoles: string[]): string[] {
  if (filters.jobTitles?.length) return filters.jobTitles.slice(0, 20);
  if (targetRoles.length) return targetRoles.slice(0, 20);
  const fromCategories = (filters.jobCategories ?? [])
    .map((c) => c.replace(/ Jobs$/i, "").trim())
    .filter(Boolean);
  if (fromCategories.length) return fromCategories.slice(0, 10);
  const query = buildStructuredQuery(filters, targetRoles);
  if (query) {
    return query.split(/\s+/).filter((w) => w.length >= 3).slice(0, 5);
  }
  return [];
}

async function fetchStructuredJobSources(input: {
  filters: VectorSearchFilters;
  targetRoles: string[];
  maxJobs: number;
  page?: number;
}): Promise<RecommendedJobSource[]> {
  const page = Math.max(1, input.page ?? input.filters.page ?? 1);
  const limit = Math.min(Math.max(input.maxJobs, RECOMMENDED_FETCH_POOL), RECOMMENDED_FETCH_POOL);
  const filters = { ...input.filters, page, limit };
  const query = buildStructuredQuery(filters, input.targetRoles);

  if (query) {
    try {
      const neural = await fetchHirebaseNeuralJobs({
        ...filters,
        query,
        limit,
        page,
      });
      if (neural.rawJobs.length) {
        return tagSourcesWithLane(
          hirebaseResultToSources(neural.rawJobs, neural.jobs, neural.companyNames, "profile_summary", limit),
          "profile_summary",
        );
      }
    } catch {
      /* fall through to lexical search */
    }
  }

  const matchRoles = matchRolesFromFilters(filters, input.targetRoles);
  if (!matchRoles.length) return [];

  const result = await fetchHirebaseRoleMatchingJobs({
    matchRoles,
    semanticQuery: query,
    filters,
  });

  return tagSourcesWithLane(
    hirebaseResultToSources(result.rawJobs, result.jobs, result.companyNames, "profile_roles", limit),
    "profile_roles",
  );
}

async function enrichAndRankSources(
  sources: RecommendedJobSource[],
  ctx: UserSearchContext,
  userId: string,
  maxJobs: number,
  options?: { fullPool?: boolean },
): Promise<VectorMatchedJob[]> {
  if (!sources.length) return [];

  void upsertJobListingCache(sourcesToCacheEntries(sources)).catch(() => {
    /* cache is best-effort */
  });

  const fetchLaneByKey = buildFetchLaneMap(sources);
  const enriched = await enrichRecommendedSources(sources, ctx.resumeText, {
    heuristicOnly: true,
    roleTitlePreferences: ctx.roleTitlePreferences,
    profileSkills: ctx.profileSkills,
    excludeMatchTerms: ctx.nameMatchExcludeTerms,
  });

  const { index } = await loadTrackedCompanyIndex(userId);
  const rankOptions = {
    filterStale: false,
    roleTitlePreferences: ctx.roleTitlePreferences,
    profileSkills: ctx.profileSkills,
    fetchLaneByKey,
  };
  const isTrackedFn = (job: VectorMatchedJob) => companyNameMatchesTracked(job.companyName, index);

  if (options?.fullPool) {
    return rankRecommendedJobPool(enriched, isTrackedFn, rankOptions);
  }

  return finalizeRecommendedJobs(enriched, isTrackedFn, maxJobs, rankOptions);
}

function countDistinctCompanies(jobs: VectorMatchedJob[]): number {
  return new Set(jobs.map((j) => j.companyName.trim().toLowerCase()).filter(Boolean)).size;
}

async function applyPostFetchFilters(
  sources: RecommendedJobSource[],
  filters: VectorSearchFilters,
  exclusions: ListingExclusionPrefs | undefined,
  anchorLocation: string | null,
): Promise<RecommendedJobSource[]> {
  let filtered = applyExclusionPrefsToSources(sources, exclusions);
  filtered = applyListingFiltersToSources(filtered, filters);

  const radiusMiles = filters.locationRadiusMiles;
  if (radiusMiles != null && radiusMiles > 0 && anchorLocation?.trim()) {
    const radiusFiltered = await filterSourcesByRadiusMiles(filtered, {
      anchorLocation,
      radiusMiles,
    });
    if (radiusFiltered.length) filtered = radiusFiltered;
  }

  return filtered;
}

/** Shared Hirebase structured search — recommended and user search differ only in supplement behavior. */
export async function executeUnifiedJobsSearch(input: UnifiedSearchInput): Promise<UnifiedSearchResult | null> {
  const maxJobs = Math.min(input.maxJobs ?? RECOMMENDED_SNAPSHOT_MAX_JOBS, VECTOR_SEARCH_RESULTS_MAX);
  const ctx = await loadUserSearchContext(input.userId);
  const effectiveFilters = await prepareSearchFilters(input.filters, input.userId);
  const exclusions = input.exclusions;

  const anchorLocation =
    effectiveFilters.locations?.length
      ? formatProfileLocation({
          city: effectiveFilters.locations[0]?.city,
          region: effectiveFilters.locations[0]?.region,
          country: effectiveFilters.locations[0]?.country,
        })
      : ctx.profileLocation;

  let sources = await fetchStructuredJobSources({
    filters: effectiveFilters,
    targetRoles: ctx.targetRoles,
    maxJobs: RECOMMENDED_FETCH_POOL,
  });

  sources = await applyPostFetchFilters(sources, effectiveFilters, exclusions, anchorLocation);
  sources = dedupeRecommendedSources(sources, RECOMMENDED_FETCH_POOL);

  let notice: string | undefined;
  let matchMode: RecommendedMatchMode = sources[0]?.fetchLane === "profile_summary" ? "profile_summary" : "profile_roles";

  const pipelineKeys = input.mode === "recommended" ? await loadUserPipelineDedupeKeys(input.userId) : new Set<string>();
  const rankedPool = await enrichAndRankSources(sources, ctx, input.userId, maxJobs, {
    fullPool: input.mode === "recommended",
  });

  let jobs: VectorMatchedJob[];
  let reserveJobs: VectorMatchedJob[] | undefined;

  if (input.mode === "recommended") {
    const split = splitRecommendedDisplayAndReserve(rankedPool, pipelineKeys);
    jobs = split.jobs;
    reserveJobs = split.reserveJobs;
  } else {
    jobs = rankedPool.slice(0, maxJobs);
  }

  if (input.mode === "recommended" && !jobs.length) {
    const broad = await fetchRecommendedBroadFallback({
      profileTargetRoles: ctx.targetRoles,
      maxJobs: RECOMMENDED_FETCH_POOL,
      diverse: true,
    });
    if (broad.sources.length) {
      sources = dedupeRecommendedSources(broad.sources, RECOMMENDED_FETCH_POOL);
      const broadPool = await enrichAndRankSources(sources, ctx, input.userId, maxJobs, { fullPool: true });
      const split = splitRecommendedDisplayAndReserve(broadPool, pipelineKeys);
      jobs = split.jobs;
      reserveJobs = split.reserveJobs;
      matchMode = "broad";
      notice =
        "Showing recent open roles — refine profile filters or add target roles for tighter matches.";
    }
  }

  if (input.mode === "search" && jobs.length < RECOMMENDED_MIN_DISPLAY_ROLES) {
    notice = `Showing ${jobs.length} role${jobs.length === 1 ? "" : "s"} — adjust filters for more matches.`;
  }

  if (!jobs.length) {
    return {
      jobs: [],
      reserveJobs: [],
      totalCount: 0,
      matchMode,
      companyCount: 0,
      trackedWithMatches: 0,
      notice:
        input.mode === "search"
          ? "No roles matched your filters — try loosening location, experience, or job function."
          : undefined,
      filtersApplied: effectiveFilters,
    };
  }

  const { index } = await loadTrackedCompanyIndex(input.userId);
  const trackedWithMatches = jobs.filter((j) => companyNameMatchesTracked(j.companyName, index)).length;

  return {
    jobs,
    reserveJobs,
    totalCount: jobs.length,
    matchMode,
    companyCount: countDistinctCompanies(jobs),
    trackedWithMatches,
    notice,
    filtersApplied: effectiveFilters,
  };
}

export { loadUserSearchContext };

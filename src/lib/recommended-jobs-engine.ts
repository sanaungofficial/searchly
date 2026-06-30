import { countUniqueDisplayListingKeys, jobListingDedupeKey } from "@/lib/cached-job";
import {
  buildRoleTitlePreferencesFromProfile,
  hasRoleTitlePreferenceSignals,
  type RoleTitlePreferences,
} from "@/lib/role-title-preferences";
import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import { sourcesToCacheEntries, upsertJobListingCache } from "@/lib/job-listing-cache";
import {
  hasRestrictiveListingFilters,
  hasHardRestrictiveListingFilters,
  hasSoftRestrictiveListingFilters,
  isDefaultRecommendedFilters,
  relaxRestrictiveFilters,
  relaxSoftListingFilters,
} from "@/lib/profile-preference-filters";
import {
  nextRelaxedFilters,
  EXPLICIT_FILTER_FALLBACK_LADDER,
  type FallbackRelaxStep,
} from "@/lib/opportunities-fallback-ladder";
import {
  filterJobsByLocationPreference,
  filterSourcesByLocationPreference,
  parseProfileLocationString,
  profileLocationToHirebaseFilters,
  resolveProfileLocation,
  type LocationPreferenceInput,
} from "@/lib/profile-location";
import { filterSourcesByRadiusMiles } from "@/lib/job-location-radius";
import { normalizePostedDateFilters } from "@/lib/job-posted-filter";
import { extractProfileSkills } from "@/lib/job-fit-ranking";
import { formatProfileLocation } from "@/lib/recommended-filter-utils";
import {
  buildProfileVSearchQuery,
  customJobFunctionsToSemanticQuery,
  mergeVSearchQueryParts,
  profileTextForMatchReasons,
  trimVSearchQuery,
} from "@/lib/profile-vsearch-query";
import {
  type RecommendedJobSnapshotPayload,
  type RecommendedMatchMode,
  RECOMMENDED_FETCH_POOL,
  RECOMMENDED_MIN_DISPLAY_ROLES,
  RECOMMENDED_MIN_DISTINCT_COMPANIES,
  RECOMMENDED_SNAPSHOT_MAX_JOBS,
} from "@/lib/recommended-jobs-config";
import {
  companyNameMatchesTracked,
  buildFetchLaneMap,
  dedupeRecommendedSources,
  fetchRecommendedBroadFallback,
  fetchRecommendedFromExpandedRoles,
  fetchRecommendedFromProfileRoles,
  fetchRecommendedFromSimilarJobs,
  fetchRecommendedFromTrackedCompanies,
  fetchRecommendedViaProfileSummary,
  fetchRecommendedViaResumeVSearch,
  loadTrackedCompanyIndex,
  tagSourcesWithLane,
  type RecommendedJobSource,
} from "@/lib/recommended-jobs-fallback";
import { fetchHirebaseRoleMatchingJobs } from "@/lib/hirebase";
import { jobMatchesListingFilters } from "@/lib/job-listing-filters";
import {
  buildActiveRoleSearchTitles,
  isExecutiveJobTitle,
  roleSearchRelevanceScore,
  searchTargetsExecutiveRoles,
} from "@/lib/job-match";
import { finalizeRecommendedJobs, sortRecommendedJobs, dedupeVectorMatchedJobs } from "@/lib/recommended-jobs-ranking";
import { sanitizeFiltersForHirebase } from "@/lib/opportunities-hirebase-filters";
import { hirebaseCompanyTypesFromStages, mergeSearchPreferencesIntoFilters, parseSearchPreferences } from "@/lib/search-preferences";
import { loadFlatIndustryOptions, splitIndustrySelections } from "@/lib/industry-options";
import type { ListingExclusionPrefs } from "@/lib/opportunities-exclusion-filters";
import { ensureHirebaseArtifactForUser, findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData, personalNameMatchTokens, type ParsedResumeData } from "@/lib/resume-parse";
import type { VectorMatchedJob, VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";

export type GenerateRecommendedInput = {
  userId: string;
  filters?: VectorSearchFilters;
  preferCache?: boolean;
  maxJobs?: number;
};

export type GenerateRecommendedResult = RecommendedJobSnapshotPayload & {
  artifactReEmbedded?: boolean;
  resumeVSearch?: boolean;
  effectiveFilters?: VectorSearchFilters;
};

function appendNotice(existing: string | undefined, next: string): string {
  if (!existing?.trim()) return next;
  if (existing.includes(next)) return existing;
  return `${existing} ${next}`;
}

async function loadUserContext(userId: string) {
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
    targetSalary: profile?.targetSalary ? Number.parseFloat(profile.targetSalary.replace(/[^0-9.]/g, "")) || null : null,
  });

  const profileLocation = resolveProfileLocation({
    parsedLocation: parsedData.location,
    targetMarket: profile?.targetMarket,
  });
  const priorities = profile?.priorities ?? [];
  const relocationOpenness = profile?.relocationOpenness ?? null;

  return {
    profile,
    targetRoles,
    parsedData,
    resumeText,
    profileLocation,
    priorities,
    relocationOpenness,
    roleTitlePreferences,
    profileSkills: extractProfileSkills(parsedData),
    nameMatchExcludeTerms: personalNameMatchTokens(parsedData),
    searchPreferences: parseSearchPreferences(
      parsedData && typeof parsedData === "object"
        ? (parsedData as { searchPreferences?: unknown }).searchPreferences
        : undefined,
    ),
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

function exclusionPrefsFromSearchPreferences(
  prefs: ReturnType<typeof parseSearchPreferences>,
): ListingExclusionPrefs {
  return {
    excludedJobTitles: prefs.excludedJobTitles,
    excludedIndustries: prefs.excludedIndustries,
    excludedSkills: prefs.excludedSkills,
    excludedCompanies: prefs.excludedCompanies,
    excludeSecurityClearance: prefs.excludeSecurityClearance,
    excludeUsCitizenOnly: prefs.excludeUsCitizenOnly,
    excludeStaffingAgency: prefs.excludeStaffingAgency,
  };
}

async function prepareRecommendedFilters(
  requestFilters: VectorSearchFilters,
  searchPreferences: ReturnType<typeof parseSearchPreferences>,
): Promise<VectorSearchFilters> {
  let merged = mergeSearchPreferencesIntoFilters(
    searchPreferences,
    normalizePostedDateFilters(
      sanitizeFiltersForHirebase({
        ...requestFilters,
        semanticQuery: trimVSearchQuery(requestFilters.semanticQuery ?? "") || undefined,
      }),
    ),
  );
  if (searchPreferences.companyStages?.length && !merged.companyTypes?.length) {
    merged = { ...merged, companyTypes: hirebaseCompanyTypesFromStages(searchPreferences.companyStages) };
  }
  merged = await resolveIndustryFilters(merged);
  return merged;
}

async function enrichAndRank(
  sources: RecommendedJobSource[],
  resumeText: string,
  userId: string,
  maxJobs: number,
  roleTitlePreferences: RoleTitlePreferences,
  options?: { filterStale?: boolean; profileSkills?: string[]; excludeMatchTerms?: string[] },
): Promise<VectorMatchedJob[]> {
  if (!sources.length) return [];

  void upsertJobListingCache(sourcesToCacheEntries(sources)).catch(() => {
    /* cache is best-effort */
  });

  const fetchLaneByKey = buildFetchLaneMap(sources);

  const enriched = await enrichRecommendedSources(sources, resumeText, {
    heuristicOnly: true,
    roleTitlePreferences,
    profileSkills: options?.profileSkills,
    excludeMatchTerms: options?.excludeMatchTerms,
  });

  const { index } = await loadTrackedCompanyIndex(userId);
  return finalizeRecommendedJobs(
    enriched,
    (job) => companyNameMatchesTracked(job.companyName, index),
    maxJobs,
    {
      ...options,
      roleTitlePreferences,
      profileSkills: options?.profileSkills,
      fetchLaneByKey,
    },
  );
}

function displayKeysFromJobs(jobs: VectorMatchedJob[]): Set<string> {
  return new Set(
    jobs.map((job) =>
      jobListingDedupeKey({
        companyName: job.companyName,
        title: job.title,
        url: job.url,
      }),
    ),
  );
}

function displayKeysFromSources(sources: RecommendedJobSource[]): Set<string> {
  return new Set(
    sources.map((source) =>
      jobListingDedupeKey({
        companyName: source.companyName,
        title: source.cached.title,
        url: source.cached.url,
      }),
    ),
  );
}

function countDistinctCompaniesFromSources(sources: RecommendedJobSource[]): number {
  return new Set(
    sources.map((source) => source.companyName.trim().toLowerCase()).filter(Boolean),
  ).size;
}

function countDistinctCompaniesFromJobs(jobs: VectorMatchedJob[]): number {
  return new Set(jobs.map((job) => job.companyName.trim().toLowerCase()).filter(Boolean)).size;
}

function recommendedFeedNeedsSupplement(sources: RecommendedJobSource[]): boolean {
  const displayCount = countUniqueDisplayListingKeys(
    sources.map((source) => ({
      companyName: source.companyName,
      title: source.cached.title,
      url: source.cached.url,
    })),
  );
  return (
    displayCount < RECOMMENDED_MIN_DISPLAY_ROLES ||
    countDistinctCompaniesFromSources(sources) < RECOMMENDED_MIN_DISTINCT_COMPANIES
  );
}

function locationInputFromContext(ctx: {
  profileLocation?: string | null;
  priorities?: string[];
  relocationOpenness?: string | null;
  scopeOverride?: LocationPreferenceInput["scopeOverride"];
}): LocationPreferenceInput {
  return {
    profileLocation: ctx.profileLocation,
    priorities: ctx.priorities,
    relocationOpenness: ctx.relocationOpenness,
    scopeOverride: ctx.scopeOverride,
  };
}

function mergeLocationBackfillSources<T extends RecommendedJobSource>(
  kept: T[],
  pool: T[],
  locationInput: LocationPreferenceInput,
  minCount: number,
): { sources: T[]; backfilled: boolean } {
  if (kept.length >= minCount || !pool.length) {
    return { sources: kept, backfilled: false };
  }

  const existingKeys = displayKeysFromSources(kept);
  const domesticPool = filterSourcesByLocationPreference(pool, {
    ...locationInput,
    scopeOverride: "domestic",
  });
  const extra = domesticPool.filter((source) => {
    const key = jobListingDedupeKey({
      companyName: source.companyName,
      title: source.cached.title,
      url: source.cached.url,
    });
    return key && !existingKeys.has(key);
  });

  if (!extra.length) return { sources: kept, backfilled: false };

  return {
    sources: dedupeRecommendedSources([...kept, ...extra], RECOMMENDED_FETCH_POOL),
    backfilled: true,
  };
}

function mergeLocationBackfillJobs(
  kept: VectorMatchedJob[],
  pool: VectorMatchedJob[],
  locationInput: LocationPreferenceInput,
  minCount: number,
  maxJobs: number,
): { jobs: VectorMatchedJob[]; backfilled: boolean } {
  if (kept.length >= minCount || !pool.length) {
    return { jobs: kept, backfilled: false };
  }

  const existingKeys = displayKeysFromJobs(kept);
  const domesticPool = filterJobsByLocationPreference(pool, {
    ...locationInput,
    scopeOverride: "domestic",
  });
  const extra = domesticPool.filter((job) => {
    const key = jobListingDedupeKey({
      companyName: job.companyName,
      title: job.title,
      url: job.url,
    });
    return key && !existingKeys.has(key);
  });

  if (!extra.length) return { jobs: kept, backfilled: false };

  return {
    jobs: sortRecommendedJobs(dedupeVectorMatchedJobs([...kept, ...extra])).slice(0, maxJobs),
    backfilled: true,
  };
}

async function supplementSparseRecommendedSources(input: {
  sources: RecommendedJobSource[];
  targetRoles: string[];
  semanticQuery: string;
  locationInput?: LocationPreferenceInput;
  applyLocationFilter?: boolean;
}): Promise<{ sources: RecommendedJobSource[]; supplemented: boolean }> {
  if (!recommendedFeedNeedsSupplement(input.sources)) {
    return { sources: input.sources, supplemented: false };
  }

  const broad = await fetchRecommendedBroadFallback({
    profileTargetRoles: input.targetRoles,
    semanticQuery: input.semanticQuery || undefined,
    maxJobs: RECOMMENDED_FETCH_POOL,
    diverse: true,
    excludeDisplayKeys: displayKeysFromSources(input.sources),
  });
  if (!broad.sources.length) {
    return { sources: input.sources, supplemented: false };
  }

  let extraSources = broad.sources;
  if (input.applyLocationFilter && input.locationInput) {
    extraSources = filterSourcesByLocationPreference(extraSources, {
      ...input.locationInput,
      scopeOverride: "domestic",
    });
    if (!extraSources.length) {
      return { sources: input.sources, supplemented: false };
    }
  }

  return {
    sources: dedupeRecommendedSources(
      [...input.sources, ...extraSources],
      RECOMMENDED_FETCH_POOL,
    ),
    supplemented: true,
  };
}

async function supplementSparseRecommendedJobs(input: {
  jobs: VectorMatchedJob[];
  targetRoles: string[];
  semanticQuery: string;
  resumeText: string;
  userId: string;
  maxJobs: number;
  roleTitlePreferences: RoleTitlePreferences;
  profileSkills: string[];
  profileLocation?: string | null;
  priorities?: string[];
  relocationOpenness?: string | null;
  applyLocationFilter?: boolean;
  excludeMatchTerms?: string[];
}): Promise<VectorMatchedJob[]> {
  const needsSupplement =
    input.jobs.length < RECOMMENDED_MIN_DISPLAY_ROLES ||
    countDistinctCompaniesFromJobs(input.jobs) < RECOMMENDED_MIN_DISTINCT_COMPANIES;
  if (!needsSupplement) return input.jobs;

  const broad = await fetchRecommendedBroadFallback({
    profileTargetRoles: input.targetRoles,
    semanticQuery: input.semanticQuery || undefined,
    maxJobs: RECOMMENDED_FETCH_POOL,
    diverse: true,
    excludeDisplayKeys: displayKeysFromJobs(input.jobs),
  });
  if (!broad.sources.length) return input.jobs;

  let extraSources = broad.sources;
  if (input.applyLocationFilter) {
    const locationInput = locationInputFromContext({
      profileLocation: input.profileLocation,
      priorities: input.priorities,
      relocationOpenness: input.relocationOpenness,
    });
    extraSources = filterSourcesByLocationPreference(extraSources, locationInput);
    if (!extraSources.length) {
      extraSources = filterSourcesByLocationPreference(broad.sources, {
        ...locationInput,
        scopeOverride: "domestic",
      });
    }
    if (!extraSources.length) return input.jobs;
  }

  const extra = await enrichAndRank(
    extraSources,
    input.resumeText,
    input.userId,
    input.maxJobs,
    input.roleTitlePreferences,
    {
      filterStale: false,
      profileSkills: input.profileSkills,
      excludeMatchTerms: input.excludeMatchTerms,
    },
  );
  if (!extra.length) return input.jobs;

  let merged = sortRecommendedJobs(dedupeVectorMatchedJobs([...input.jobs, ...extra])).slice(0, input.maxJobs);
  if (input.applyLocationFilter) {
    const locationInput = locationInputFromContext({
      profileLocation: input.profileLocation,
      priorities: input.priorities,
      relocationOpenness: input.relocationOpenness,
    });
    const domesticMerged = filterJobsByLocationPreference(merged, {
      ...locationInput,
      scopeOverride: "domestic",
    });
    merged =
      domesticMerged.length >= RECOMMENDED_MIN_DISPLAY_ROLES
        ? domesticMerged.slice(0, input.maxJobs)
        : domesticMerged.length > merged.length
          ? domesticMerged.slice(0, input.maxJobs)
          : merged;
    const backfill = mergeLocationBackfillJobs(
      merged,
      sortRecommendedJobs(dedupeVectorMatchedJobs([...input.jobs, ...extra])),
      { ...locationInput, scopeOverride: "domestic" },
      RECOMMENDED_MIN_DISPLAY_ROLES,
      input.maxJobs,
    );
    merged = backfill.jobs;
  }
  return merged;
}

async function ensureMinimumRecommendedJobs(input: {
  jobs: VectorMatchedJob[];
  targetRoles: string[];
  semanticQuery: string;
  resumeText: string;
  userId: string;
  maxJobs: number;
  roleTitlePreferences: RoleTitlePreferences;
  profileSkills: string[];
  profileLocation?: string | null;
  priorities?: string[];
  relocationOpenness?: string | null;
  excludeMatchTerms?: string[];
}): Promise<VectorMatchedJob[]> {
  if (input.jobs.length >= RECOMMENDED_MIN_DISPLAY_ROLES) return input.jobs;

  const locationInput = locationInputFromContext({
    profileLocation: input.profileLocation,
    priorities: input.priorities,
    relocationOpenness: input.relocationOpenness,
  });
  const hasLocation = Boolean(parseProfileLocationString(input.profileLocation));
  let jobs = input.jobs;

  for (let attempt = 0; attempt < 4 && jobs.length < RECOMMENDED_MIN_DISPLAY_ROLES; attempt++) {
    const broad = await fetchRecommendedBroadFallback({
      profileTargetRoles: input.targetRoles,
      semanticQuery: input.semanticQuery || undefined,
      maxJobs: RECOMMENDED_FETCH_POOL,
      diverse: true,
      excludeDisplayKeys: displayKeysFromJobs(jobs),
    });
    if (!broad.sources.length) break;

    let extraSources = broad.sources;
    if (hasLocation && attempt < 2) {
      extraSources = filterSourcesByLocationPreference(extraSources, {
        ...locationInput,
        scopeOverride: "domestic",
      });
      if (!extraSources.length) break;
    }

    const extra = await enrichAndRank(
      extraSources,
      input.resumeText,
      input.userId,
      input.maxJobs,
      input.roleTitlePreferences,
      {
        filterStale: false,
        profileSkills: input.profileSkills,
        excludeMatchTerms: input.excludeMatchTerms,
      },
    );
    if (!extra.length) break;

    jobs = sortRecommendedJobs(dedupeVectorMatchedJobs([...jobs, ...extra])).slice(0, input.maxJobs);
    if (hasLocation && attempt === 0) {
      const domesticJobs = filterJobsByLocationPreference(jobs, {
        ...locationInput,
        scopeOverride: "domestic",
      });
      if (domesticJobs.length >= RECOMMENDED_MIN_DISPLAY_ROLES) {
        jobs = domesticJobs.slice(0, input.maxJobs);
      } else if (domesticJobs.length > jobs.length) {
        jobs = domesticJobs.slice(0, input.maxJobs);
      }
    }
  }

  return jobs.slice(0, input.maxJobs);
}

type PrimaryFetchResult = {
  sources: RecommendedJobSource[];
  matchMode: RecommendedMatchMode;
  companyCount: number;
  trackedWithMatches: number;
  resumeVSearch: boolean;
  notice?: string;
};

async function fetchPrimaryRecommendedSources(input: {
  userId: string;
  targetRoles: string[];
  roleTitlePreferences: RoleTitlePreferences;
  profile: Awaited<ReturnType<typeof loadUserContext>>["profile"];
  parsedData: Awaited<ReturnType<typeof loadUserContext>>["parsedData"];
  artifactId: string | null;
  filters: VectorSearchFilters;
  semanticQuery: string;
  maxJobs: number;
  preferCache: boolean;
  exclusions?: ListingExclusionPrefs;
}): Promise<PrimaryFetchResult> {
  const empty: PrimaryFetchResult = {
    sources: [],
    matchMode: "profile_roles",
    companyCount: 0,
    trackedWithMatches: 0,
    resumeVSearch: false,
  };

  let matchMode: RecommendedMatchMode = "profile_roles";
  let sources: RecommendedJobSource[] = [];
  let companyCount = 0;
  let trackedWithMatches = 0;
  let notice: string | undefined;
  let resumeVSearch = false;

  if (input.artifactId) {
    try {
      const result = await fetchRecommendedViaResumeVSearch({
        userId: input.userId,
        artifactId: input.artifactId,
        profileTargetRoles: input.targetRoles,
        filters: input.filters,
        semanticQuery: input.semanticQuery || undefined,
        maxJobs: RECOMMENDED_FETCH_POOL,
        exclusions: input.exclusions,
      });
      sources = result.sources;
      companyCount = result.companyCount;
      trackedWithMatches = result.trackedWithMatches;
      matchMode = "resume";
      resumeVSearch = true;
    } catch {
      sources = [];
    }
  }

  if (!sources.length) {
    const summaryQuery =
      buildProfileVSearchQuery({
        headline: input.profile?.headline,
        targetRoles: input.targetRoles,
        resumeText: input.profile?.resumeText,
        parsedData: input.parsedData,
        careerMotivation: input.profile?.careerMotivation,
        priorities: input.profile?.priorities ?? [],
        employmentStatus: input.profile?.employmentStatus,
        jobTimeline: input.profile?.jobTimeline,
        semanticQuery: input.semanticQuery || undefined,
        customJobFunctions: input.filters.customJobFunctions,
      }) ?? trimVSearchQuery(input.targetRoles.join(", "));

    if (summaryQuery) {
      try {
        const summary = await fetchRecommendedViaProfileSummary({
          userId: input.userId,
          query: summaryQuery,
          profileTargetRoles: input.targetRoles,
          filters: input.filters,
          maxJobs: RECOMMENDED_FETCH_POOL,
        });
        if (summary.sources.length) {
          sources = summary.sources;
          companyCount = summary.companyCount;
          trackedWithMatches = summary.trackedWithMatches;
          matchMode = "profile_summary";
          notice = input.artifactId
            ? "Resume matching returned no strong fits — showing profile-based matches."
            : undefined;
        }
      } catch {
        /* fall through */
      }
    }
  }

  // Global target-title search + watchlist jobs — always merge; watchlist boosts rank, never hard-filters the feed.
  const supplemental: RecommendedJobSource[] = [];
  let profileRoleCount = 0;

  if (input.targetRoles.length || input.semanticQuery?.trim()) {
    const roles = await fetchRecommendedFromProfileRoles({
      profileTargetRoles: input.targetRoles,
      filters: input.filters,
      semanticQuery: input.semanticQuery || undefined,
      maxJobs: input.maxJobs * 2,
    });
    profileRoleCount = roles.sources.length;
    supplemental.push(...roles.sources);
  }

  const tracked = await fetchRecommendedFromTrackedCompanies({
    userId: input.userId,
    profileTargetRoles: input.targetRoles,
    filters: input.filters,
    maxJobs: input.maxJobs * 2,
    preferCache: input.preferCache,
  });
  supplemental.push(...tracked.sources);
  trackedWithMatches = Math.max(trackedWithMatches, tracked.trackedWithMatches);
  companyCount = Math.max(companyCount, tracked.companyCount);

  if (sources.length) {
    try {
      const similar = await fetchRecommendedFromSimilarJobs({
        seedSources: sources,
        filters: input.filters,
        maxJobs: Math.min(24, input.maxJobs * 2),
      });
      supplemental.push(...similar.sources);
    } catch {
      /* similar-job vsearch is best-effort */
    }
  }

  if (input.targetRoles.length || hasRoleTitlePreferenceSignals(input.roleTitlePreferences)) {
    try {
      const expanded = await fetchRecommendedFromExpandedRoles({
        userId: input.userId,
        roleTitlePreferences: input.roleTitlePreferences,
        filters: input.filters,
        maxJobs: Math.min(24, input.maxJobs * 2),
      });
      supplemental.push(...expanded.sources);
    } catch {
      /* expanded role titles are best-effort */
    }
  }

  if (supplemental.length) {
    const primaryCount = sources.length;
    sources = dedupeRecommendedSources([...sources, ...supplemental], RECOMMENDED_FETCH_POOL);
    companyCount = Math.max(companyCount, countDistinctCompaniesFromSources(sources));

    if (!primaryCount && sources.length) {
      if (profileRoleCount > 0) {
        matchMode = "profile_roles";
        notice = notice ?? "Showing roles that match your target titles.";
      } else {
        matchMode = "tracked";
        notice =
          notice ??
          (input.artifactId
            ? "Showing open roles at your tracked companies — add target roles for broader matches."
            : "Track companies for a ranking boost — add target roles for broader matches.");
      }
    } else if (primaryCount && sources.length > primaryCount) {
      notice = appendNotice(
        notice,
        "Included target-title and watchlist matches alongside your top fits.",
      );
    }
  }

  if (!sources.length) return empty;

  return {
    sources,
    matchMode,
    companyCount,
    trackedWithMatches,
    resumeVSearch,
    notice,
  };
}

export async function generateRecommendedJobsForUser(
  input: GenerateRecommendedInput,
): Promise<GenerateRecommendedResult | null> {
  if (!isHirebaseConfigured()) return null;

  const maxJobs = Math.min(input.maxJobs ?? RECOMMENDED_SNAPSHOT_MAX_JOBS, VECTOR_SEARCH_RESULTS_MAX);
  const requestFilters = input.filters ?? {};
  const semanticQuery = trimVSearchQuery(requestFilters.semanticQuery ?? "");

  if (semanticQuery) {
    return generateActiveRoleSearchForUser(input, semanticQuery, maxJobs);
  }

  const {
    targetRoles,
    resumeText,
    parsedData,
    profile,
    profileLocation,
    priorities,
    relocationOpenness,
    roleTitlePreferences,
    profileSkills,
    nameMatchExcludeTerms,
    searchPreferences,
  } = await loadUserContext(input.userId);
  const defaultFeed = isDefaultRecommendedFilters(requestFilters);
  const locationInput = locationInputFromContext({ profileLocation, priorities, relocationOpenness });
  const exclusions = exclusionPrefsFromSearchPreferences(searchPreferences);
  let mergedFilters = await prepareRecommendedFilters(requestFilters, searchPreferences);

  const artifact = await ensureHirebaseArtifactForUser(input.userId);
  const preferCache = input.preferCache !== false;

  let effectiveFilters = mergedFilters;
  let primary = await fetchPrimaryRecommendedSources({
    userId: input.userId,
    targetRoles,
    roleTitlePreferences,
    profile,
    parsedData,
    artifactId: artifact.artifactId,
    filters: mergedFilters,
    semanticQuery,
    maxJobs,
    preferCache,
    exclusions,
  });

  let { sources, matchMode, companyCount, trackedWithMatches, notice, resumeVSearch } = primary;

  async function retryPrimaryWithRelaxedFilters(reason: string, softOnly: boolean) {
    const relaxed = softOnly ? relaxSoftListingFilters(mergedFilters) : relaxRestrictiveFilters(mergedFilters);
    primary = await fetchPrimaryRecommendedSources({
      userId: input.userId,
      targetRoles,
      roleTitlePreferences,
      profile,
      parsedData,
      artifactId: artifact.artifactId,
      filters: relaxed,
      semanticQuery,
      maxJobs,
      preferCache,
      exclusions,
    });
    if (!primary.sources.length) return;
    sources = primary.sources;
    matchMode = primary.matchMode;
    companyCount = primary.companyCount;
    trackedWithMatches = primary.trackedWithMatches;
    resumeVSearch = primary.resumeVSearch;
    notice = appendNotice(primary.notice, reason);
    effectiveFilters = relaxed;
  }

  if (!sources.length) {
    if (defaultFeed && hasRestrictiveListingFilters(mergedFilters)) {
      await retryPrimaryWithRelaxedFilters(
        "No roles matched salary, date, or location filters — showing broader matches. Clear or loosen those filters to refine.",
        false,
      );
    } else if (!defaultFeed && hasSoftRestrictiveListingFilters(mergedFilters)) {
      await retryPrimaryWithRelaxedFilters(
        "No roles matched salary or date filters — try loosening those, or clear location and experience filters.",
        true,
      );
    } else if (!defaultFeed && hasHardRestrictiveListingFilters(mergedFilters)) {
      const completedSteps: FallbackRelaxStep[] = [];
      let candidate = mergedFilters;
      while (true) {
        const next = nextRelaxedFilters(candidate, completedSteps, EXPLICIT_FILTER_FALLBACK_LADDER);
        if (!next) break;
        completedSteps.push(next.step);
        candidate = next.filters;
        primary = await fetchPrimaryRecommendedSources({
          userId: input.userId,
          targetRoles,
          roleTitlePreferences,
          profile,
          parsedData,
          artifactId: artifact.artifactId,
          filters: candidate,
          semanticQuery,
          maxJobs,
          preferCache,
          exclusions,
        });
        if (!primary.sources.length) continue;
        sources = primary.sources;
        matchMode = primary.matchMode;
        companyCount = primary.companyCount;
        trackedWithMatches = primary.trackedWithMatches;
        resumeVSearch = primary.resumeVSearch;
        notice = appendNotice(
          primary.notice,
          "Loosened one filter to find matches — refine filters to narrow results.",
        );
        effectiveFilters = candidate;
        break;
      }
    }
  }

  if (!sources.length && defaultFeed) {
    const broad = await fetchRecommendedBroadFallback({
      profileTargetRoles: targetRoles,
      semanticQuery: semanticQuery || undefined,
      maxJobs: RECOMMENDED_FETCH_POOL,
      diverse: true,
    });
    if (broad.sources.length) {
      sources = broad.sources;
      matchMode = "broad";
      notice = appendNotice(
        notice,
        "Showing recent open roles — add target roles, upload a resume, or track companies for tighter matches.",
      );
    }
  }

  if (!sources.length) {
    if (!defaultFeed) {
      return {
        jobs: [],
        matchMode: "profile_roles",
        companyCount: 0,
        trackedWithMatches: 0,
        notice:
          "No roles matched your filters — try loosening location, experience, or category, or clear filters to see your full feed.",
        artifactReEmbedded: artifact.reEmbedded,
        resumeVSearch: false,
        effectiveFilters: mergedFilters,
      };
    }
    return null;
  }

  sources = dedupeRecommendedSources(sources, RECOMMENDED_FETCH_POOL);

  if (recommendedFeedNeedsSupplement(sources)) {
    if (defaultFeed && hasRestrictiveListingFilters(effectiveFilters)) {
      await retryPrimaryWithRelaxedFilters(
        "Filters were too narrow — showing broader matches. Loosen salary, date, or radius to refine.",
        false,
      );
      sources = dedupeRecommendedSources(sources, RECOMMENDED_FETCH_POOL);
    } else if (!defaultFeed && hasSoftRestrictiveListingFilters(effectiveFilters)) {
      await retryPrimaryWithRelaxedFilters(
        "Salary or date filters were too narrow — loosen those to see more matches in your selected geography and level.",
        true,
      );
      sources = dedupeRecommendedSources(sources, RECOMMENDED_FETCH_POOL);
    }
  }

  if (defaultFeed) {
    const sparseSupplement = await supplementSparseRecommendedSources({
      sources,
      targetRoles,
      semanticQuery,
      locationInput,
      applyLocationFilter: true,
    });
    if (sparseSupplement.supplemented) {
      sources = sparseSupplement.sources;
      matchMode = matchMode === "broad" ? matchMode : "broad";
      notice = appendNotice(
        notice,
        "Added broader roles to fill your feed — personalized matches were sparse.",
      );
    }
  }

  const sourcesBeforeLocation = sources;
  if (defaultFeed) {
    const locationFiltered = filterSourcesByLocationPreference(sources, locationInput);
    const backfill = mergeLocationBackfillSources(
      locationFiltered.length ? locationFiltered : [],
      sourcesBeforeLocation,
      locationInput,
      Math.min(RECOMMENDED_FETCH_POOL, RECOMMENDED_MIN_DISPLAY_ROLES * 3),
    );
    if (backfill.sources.length) {
      sources = backfill.sources;
      if (backfill.backfilled) {
        notice = appendNotice(
          notice,
          "Included US-wide and remote roles to fill your feed — enable relocation in Career preferences to narrow geography.",
        );
      }
    } else if (sourcesBeforeLocation.length) {
      sources = [];
      notice = appendNotice(
        notice,
        "No roles matched your location — check Career preferences or enable relocation to see broader geography.",
      );
    }
  }

  const radiusMiles = mergedFilters.locationRadiusMiles;
  const anchorLocation = defaultFeed
    ? profileLocation
    : mergedFilters.locations?.length
      ? formatProfileLocation({
          city: mergedFilters.locations[0]?.city,
          region: mergedFilters.locations[0]?.region,
          country: mergedFilters.locations[0]?.country,
        })
      : profileLocation;

  if (radiusMiles != null && radiusMiles > 0 && anchorLocation?.trim()) {
    const beforeRadius = sources;
    const radiusFiltered = await filterSourcesByRadiusMiles(sources, {
      anchorLocation,
      radiusMiles,
      priorities,
      relocationOpenness,
    });
    if (radiusFiltered.length) {
      sources = radiusFiltered;
    } else if (beforeRadius.length) {
      sources = beforeRadius;
      notice = appendNotice(
        notice,
        `No roles within ${radiusMiles} miles — showing broader results. Increase radius or enable relocation in filters.`,
      );
    }
  }

  let jobs = await enrichAndRank(sources, resumeText, input.userId, maxJobs, roleTitlePreferences, {
    filterStale: false,
    profileSkills,
    excludeMatchTerms: nameMatchExcludeTerms,
  });

  if (
    defaultFeed &&
    (jobs.length < RECOMMENDED_MIN_DISPLAY_ROLES || countDistinctCompaniesFromJobs(jobs) < RECOMMENDED_MIN_DISTINCT_COMPANIES)
  ) {
    const beforeCount = jobs.length;
    jobs = await supplementSparseRecommendedJobs({
      jobs,
      targetRoles,
      semanticQuery,
      resumeText,
      userId: input.userId,
      maxJobs,
      roleTitlePreferences,
      profileSkills,
      profileLocation,
      priorities,
      relocationOpenness,
      applyLocationFilter: defaultFeed,
      excludeMatchTerms: nameMatchExcludeTerms,
    });
    if (jobs.length > beforeCount) {
      matchMode = matchMode === "broad" ? matchMode : "broad";
      notice = appendNotice(
        notice,
        "Added more open roles to fill your feed — your best matches still appear first.",
      );
    }
  }

  if (!jobs.length && defaultFeed) {
    let broadSources = (
      await fetchRecommendedBroadFallback({
        profileTargetRoles: targetRoles,
        semanticQuery: semanticQuery || undefined,
        maxJobs: RECOMMENDED_FETCH_POOL,
        diverse: true,
      })
    ).sources;
    if (defaultFeed && broadSources.length) {
      const filtered = filterSourcesByLocationPreference(broadSources, locationInput);
      const backfill = mergeLocationBackfillSources(
        filtered,
        broadSources,
        locationInput,
        RECOMMENDED_MIN_DISPLAY_ROLES,
      );
      broadSources = backfill.sources.length ? backfill.sources : filtered;
    }
    if (broadSources.length) {
      sources = broadSources;
      matchMode = "broad";
      jobs = await enrichAndRank(sources, resumeText, input.userId, maxJobs, roleTitlePreferences, {
        filterStale: false,
        profileSkills,
        excludeMatchTerms: nameMatchExcludeTerms,
      });
      notice = appendNotice(
        notice,
        "Added more open roles to fill your feed — your best matches still appear first.",
      );
    }
  }

  let jobsBeforeFinalLocation = jobs;
  if (defaultFeed && jobs.length) {
    jobs = filterJobsByLocationPreference(jobs, locationInput);
    const backfill = mergeLocationBackfillJobs(
      jobs,
      jobsBeforeFinalLocation,
      locationInput,
      RECOMMENDED_MIN_DISPLAY_ROLES,
      maxJobs,
    );
    jobs = backfill.jobs;
    if (backfill.backfilled && jobs.length > jobsBeforeFinalLocation.length) {
      notice = appendNotice(
        notice,
        "Included US-wide and remote roles to fill your feed — enable relocation in Career preferences to narrow geography.",
      );
    }
  }

  if (!jobs.length) return null;

  if (hasRestrictiveListingFilters(effectiveFilters)) {
    jobs = jobs.filter((job) => jobMatchesListingFilters(job, job.companyName, effectiveFilters));
  }

  if (!jobs.length) {
    if (!defaultFeed) {
      return {
        jobs: [],
        matchMode,
        companyCount,
        trackedWithMatches,
        notice:
          notice ??
          "No roles matched your filters — try loosening location, experience, or category, or clear filters to see your full feed.",
        artifactReEmbedded: artifact.reEmbedded,
        resumeVSearch,
        effectiveFilters,
      };
    }
    return null;
  }

  if (defaultFeed && jobs.length < RECOMMENDED_MIN_DISPLAY_ROLES) {
    const beforeFill = jobs.length;
    jobs = await ensureMinimumRecommendedJobs({
      jobs,
      targetRoles,
      semanticQuery,
      resumeText,
      userId: input.userId,
      maxJobs,
      roleTitlePreferences,
      profileSkills,
      profileLocation,
      priorities,
      relocationOpenness,
      excludeMatchTerms: nameMatchExcludeTerms,
    });
    if (jobs.length > beforeFill) {
      matchMode = matchMode === "broad" ? matchMode : "broad";
      notice = appendNotice(
        notice,
        "Added more open roles to fill your feed — your best matches still appear first.",
      );
    }
  }

  return {
    jobs,
    matchMode,
    companyCount,
    trackedWithMatches,
    notice,
    artifactReEmbedded: artifact.reEmbedded,
    resumeVSearch,
    effectiveFilters,
  };
}

/** Active role search — Hirebase title search only; no recommendation hierarchy or supplements. */
async function generateActiveRoleSearchForUser(
  input: GenerateRecommendedInput,
  semanticQuery: string,
  maxJobs: number,
): Promise<GenerateRecommendedResult | null> {
  const requestFilters = input.filters ?? {};
  const {
    resumeText,
    roleTitlePreferences,
    profileSkills,
    nameMatchExcludeTerms,
    profileLocation,
    priorities,
    relocationOpenness,
  } = await loadUserContext(input.userId);

  const searchRoles = buildActiveRoleSearchTitles(
    mergeVSearchQueryParts(semanticQuery, customJobFunctionsToSemanticQuery(requestFilters.customJobFunctions)) ?? semanticQuery,
    requestFilters.jobTitles,
  );
  if (!searchRoles.length) return null;

  const locationInput = locationInputFromContext({ profileLocation, priorities, relocationOpenness });
  let mergedFilters = normalizePostedDateFilters(
    sanitizeFiltersForHirebase({
      ...requestFilters,
      semanticQuery,
      limit: maxJobs,
      page: requestFilters.page ?? 1,
    }),
  );
  if (!mergedFilters.locations?.length) {
    const hirebaseLocations = profileLocationToHirebaseFilters(locationInput);
    if (hirebaseLocations.length) {
      mergedFilters = { ...mergedFilters, locations: hirebaseLocations };
    }
  }

  try {
    const result = await fetchHirebaseRoleMatchingJobs({
      matchRoles: searchRoles,
      semanticQuery,
      filters: mergedFilters,
      activeSearch: true,
    });

    let sources: RecommendedJobSource[] = [];
    for (let i = 0; i < result.rawJobs.length; i++) {
      const raw = result.rawJobs[i];
      const cached = result.jobs[i];
      if (!cached) continue;
      sources.push({
        cached,
        companyName: result.companyNames[i] ?? raw.company_name?.trim() ?? "Unknown company",
        raw,
      });
    }
    sources = tagSourcesWithLane(sources, "profile_roles");

    if (!searchTargetsExecutiveRoles(semanticQuery)) {
      sources = sources.filter((source) => !isExecutiveJobTitle(source.cached.title));
    }

    sources.sort(
      (a, b) =>
        roleSearchRelevanceScore(b.cached.title, searchRoles) -
        roleSearchRelevanceScore(a.cached.title, searchRoles),
    );

    if (!sources.length) return null;

    const jobs = await enrichAndRank(sources, resumeText, input.userId, maxJobs, roleTitlePreferences, {
      filterStale: false,
      profileSkills,
      excludeMatchTerms: nameMatchExcludeTerms,
    });

    jobs.sort(
      (a, b) =>
        roleSearchRelevanceScore(b.title, searchRoles) - roleSearchRelevanceScore(a.title, searchRoles),
    );

    return {
      jobs: jobs.slice(0, maxJobs),
      matchMode: "profile_roles",
      companyCount: new Set(jobs.map((j) => j.companyName.trim().toLowerCase()).filter(Boolean)).size,
      trackedWithMatches: 0,
      notice: undefined,
      effectiveFilters: mergedFilters,
    };
  } catch {
    return null;
  }
}

export function hasProfileSignals(input: {
  targetRoles: string[];
  roleTitlePreferences?: RoleTitlePreferences;
  resumeAssetUrl: string | null;
  profileResumeUrl: string | null | undefined;
  resumeText: string;
  parsedData: ParsedResumeData;
}): boolean {
  if (input.roleTitlePreferences && hasRoleTitlePreferenceSignals(input.roleTitlePreferences)) return true;
  if (input.targetRoles.length > 0) return true;
  if (input.resumeAssetUrl || input.profileResumeUrl) return true;
  if (input.resumeText.trim().length >= 40) return true;
  return (
    input.parsedData.skills.length > 0 ||
    input.parsedData.tools.length > 0 ||
    input.parsedData.workExperience.length > 0
  );
}

export async function userEligibleForRecommendedSnapshot(userId: string): Promise<boolean> {
  const ctx = await loadUserContext(userId);
  const resumeAsset = await findResumeAssetForUser(userId);
  return hasProfileSignals({
    targetRoles: ctx.targetRoles,
    roleTitlePreferences: ctx.roleTitlePreferences,
    resumeAssetUrl: resumeAsset?.url ?? null,
    profileResumeUrl: ctx.profile?.resumeUrl,
    resumeText: ctx.resumeText,
    parsedData: ctx.parsedData,
  });
}

import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import { sourcesToCacheEntries, upsertJobListingCache } from "@/lib/job-listing-cache";
import {
  hasRestrictiveListingFilters,
  isDefaultRecommendedFilters,
  relaxRestrictiveFilters,
} from "@/lib/profile-preference-filters";
import {
  filterSourcesByLocationPreference,
} from "@/lib/profile-location";
import {
  buildProfileVSearchQuery,
  profileTextForMatchReasons,
  trimVSearchQuery,
} from "@/lib/profile-vsearch-query";
import {
  type RecommendedJobSnapshotPayload,
  type RecommendedMatchMode,
  RECOMMENDED_FETCH_POOL,
  RECOMMENDED_SNAPSHOT_MAX_JOBS,
} from "@/lib/recommended-jobs-config";
import {
  companyNameMatchesTracked,
  dedupeRecommendedSources,
  fetchRecommendedBroadFallback,
  fetchRecommendedFromProfileRoles,
  fetchRecommendedFromTrackedCompanies,
  fetchRecommendedViaProfileSummary,
  fetchRecommendedViaResumeVSearch,
  loadTrackedCompanyIndex,
  type RecommendedJobSource,
} from "@/lib/recommended-jobs-fallback";
import { finalizeRecommendedJobs } from "@/lib/recommended-jobs-ranking";
import { ensureHirebaseArtifactForUser, findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
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
  const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
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

  const profileLocation = parsedData.location ?? null;
  const priorities = profile?.priorities ?? [];

  return { profile, targetRoles, parsedData, resumeText, profileLocation, priorities };
}

async function enrichAndRank(
  sources: RecommendedJobSource[],
  resumeText: string,
  userId: string,
  maxJobs: number,
  options?: { filterStale?: boolean },
): Promise<VectorMatchedJob[]> {
  if (!sources.length) return [];

  void upsertJobListingCache(sourcesToCacheEntries(sources)).catch(() => {
    /* cache is best-effort */
  });

  const enriched = await enrichRecommendedSources(sources, resumeText, {
    heuristicOnly: true,
  });

  const { index } = await loadTrackedCompanyIndex(userId);
  return finalizeRecommendedJobs(
    enriched,
    (job) => companyNameMatchesTracked(job.companyName, index),
    maxJobs,
    options,
  );
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
  profile: Awaited<ReturnType<typeof loadUserContext>>["profile"];
  parsedData: Awaited<ReturnType<typeof loadUserContext>>["parsedData"];
  artifactId: string | null;
  filters: VectorSearchFilters;
  semanticQuery: string;
  maxJobs: number;
  preferCache: boolean;
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

  if (!sources.length) {
    const tracked = await fetchRecommendedFromTrackedCompanies({
      userId: input.userId,
      profileTargetRoles: input.targetRoles,
      filters: input.filters,
      maxJobs: input.maxJobs * 2,
      preferCache: input.preferCache,
    });
    if (tracked.sources.length) {
      sources = tracked.sources;
      companyCount = tracked.companyCount;
      trackedWithMatches = tracked.trackedWithMatches;
      matchMode = "tracked";
      notice =
        notice ??
        (input.artifactId
          ? "Showing open roles at your tracked companies."
          : "Track companies for a ranking boost — showing watchlist matches.");
    }
  }

  if (!sources.length && input.targetRoles.length) {
    const roles = await fetchRecommendedFromProfileRoles({
      profileTargetRoles: input.targetRoles,
      filters: input.filters,
      semanticQuery: input.semanticQuery || undefined,
      maxJobs: input.maxJobs * 2,
    });
    sources = roles.sources;
    matchMode = "profile_roles";
    notice = notice ?? "Showing roles that match your target titles.";
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

  const {
    targetRoles,
    resumeText,
    parsedData,
    profile,
    profileLocation,
    priorities,
  } = await loadUserContext(input.userId);
  const defaultFeed = isDefaultRecommendedFilters(requestFilters);
  /** Default feed uses profile location post-filter only. Custom searches use explicit UI filters — no silent profile merge. */
  const mergedFilters = {
    ...requestFilters,
    semanticQuery: semanticQuery || undefined,
  };

  const artifact = await ensureHirebaseArtifactForUser(input.userId);
  const preferCache = input.preferCache !== false;

  let effectiveFilters = mergedFilters;
  let primary = await fetchPrimaryRecommendedSources({
    userId: input.userId,
    targetRoles,
    profile,
    parsedData,
    artifactId: artifact.artifactId,
    filters: mergedFilters,
    semanticQuery,
    maxJobs,
    preferCache,
  });

  let { sources, matchMode, companyCount, trackedWithMatches, notice, resumeVSearch } = primary;

  if (!sources.length && hasRestrictiveListingFilters(mergedFilters)) {
    const relaxed = relaxRestrictiveFilters(mergedFilters);
    primary = await fetchPrimaryRecommendedSources({
      userId: input.userId,
      targetRoles,
      profile,
      parsedData,
      artifactId: artifact.artifactId,
      filters: relaxed,
      semanticQuery,
      maxJobs,
      preferCache,
    });
    if (primary.sources.length) {
      sources = primary.sources;
      matchMode = primary.matchMode;
      companyCount = primary.companyCount;
      trackedWithMatches = primary.trackedWithMatches;
      resumeVSearch = primary.resumeVSearch;
      notice = appendNotice(
        primary.notice,
        "No roles matched salary, date, or location filters — showing broader matches. Clear or loosen those filters to refine.",
      );
      effectiveFilters = relaxed;
    }
  }

  if (!sources.length) {
    const broad = await fetchRecommendedBroadFallback({
      profileTargetRoles: targetRoles,
      semanticQuery: semanticQuery || undefined,
      maxJobs: RECOMMENDED_FETCH_POOL,
    });
    if (broad.sources.length) {
      sources = broad.sources;
      matchMode = "broad";
      notice = appendNotice(
        notice,
        "Showing recent roles from Hirebase — add target roles, upload a resume, or track companies for tighter matches.",
      );
    }
  }

  if (!sources.length) return null;

  sources = dedupeRecommendedSources(sources, RECOMMENDED_FETCH_POOL);

  const sourcesBeforeLocation = sources;
  if (defaultFeed) {
    const locationFiltered = filterSourcesByLocationPreference(sources, { profileLocation, priorities });
    if (locationFiltered.length) {
      sources = locationFiltered;
    } else if (sourcesBeforeLocation.length) {
      sources = sourcesBeforeLocation;
      notice = appendNotice(
        notice,
        "No roles matched your location preferences — showing broader geography. Location matches city, state, or country text (not a mile radius).",
      );
    }
  }

  let jobs = await enrichAndRank(sources, resumeText, input.userId, maxJobs, {
    filterStale: defaultFeed,
  });

  if (!jobs.length && sources.length) {
    jobs = await enrichAndRank(sources, resumeText, input.userId, maxJobs, {
      filterStale: false,
    });
    if (jobs.length) {
      notice = appendNotice(
        notice,
        "Including roles older than 3 days so you still have options to review.",
      );
    }
  }

  if (!jobs.length) {
    const broad = await fetchRecommendedBroadFallback({
      profileTargetRoles: targetRoles,
      semanticQuery: semanticQuery || undefined,
      maxJobs: RECOMMENDED_FETCH_POOL,
    });
    if (broad.sources.length) {
      sources = broad.sources;
      matchMode = "broad";
      jobs = await enrichAndRank(sources, resumeText, input.userId, maxJobs, {
        filterStale: false,
      });
      notice = appendNotice(
        notice,
        "Showing recent roles from Hirebase while personalized matches are sparse.",
      );
    }
  }

  if (!jobs.length) return null;

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

export function hasProfileSignals(input: {
  targetRoles: string[];
  resumeAssetUrl: string | null;
  profileResumeUrl: string | null | undefined;
  resumeText: string;
  parsedData: ReturnType<typeof normalizeParsedResumeData>;
}): boolean {
  if (input.targetRoles.length > 0) return true;
  if (input.resumeAssetUrl || input.profileResumeUrl) return true;
  if (input.resumeText.trim().length >= 40) return true;
  return (input.parsedData?.workExperience?.length ?? 0) > 0;
}

export async function userEligibleForRecommendedSnapshot(userId: string): Promise<boolean> {
  const ctx = await loadUserContext(userId);
  const resumeAsset = await findResumeAssetForUser(userId);
  return hasProfileSignals({
    targetRoles: ctx.targetRoles,
    resumeAssetUrl: resumeAsset?.url ?? null,
    profileResumeUrl: ctx.profile?.resumeUrl,
    resumeText: ctx.resumeText,
    parsedData: ctx.parsedData,
  });
}

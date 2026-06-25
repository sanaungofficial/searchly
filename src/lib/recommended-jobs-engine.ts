import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import { sourcesToCacheEntries, upsertJobListingCache } from "@/lib/job-listing-cache";
import {
  isDefaultRecommendedFilters,
  mergeProfileAndRequestFilters,
  profilePreferencesToFilters,
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

  const profilePrefs = profilePreferencesToFilters({
    priorities,
    targetSalary: profile?.targetSalary,
    employmentStatus: profile?.employmentStatus,
    jobTimeline: profile?.jobTimeline,
    profileLocation,
  });

  return { profile, targetRoles, parsedData, resumeText, profilePrefs, profileLocation, priorities };
}

async function enrichAndRank(
  sources: RecommendedJobSource[],
  resumeText: string,
  userId: string,
  maxJobs: number,
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
  );
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
    profilePrefs,
    parsedData,
    profile,
    profileLocation,
    priorities,
  } = await loadUserContext(input.userId);
  const defaultFeed = isDefaultRecommendedFilters(requestFilters);
  const mergedFilters = defaultFeed
    ? {
        ...requestFilters,
        semanticQuery: semanticQuery || undefined,
      }
    : mergeProfileAndRequestFilters(profilePrefs, {
        ...requestFilters,
        semanticQuery: semanticQuery || undefined,
      });

  const artifact = await ensureHirebaseArtifactForUser(input.userId);
  const preferCache = input.preferCache !== false;

  let matchMode: RecommendedMatchMode = "profile_roles";
  let sources: RecommendedJobSource[] = [];
  let companyCount = 0;
  let trackedWithMatches = 0;
  let notice: string | undefined;
  let resumeVSearch = false;

  if (artifact.artifactId) {
    try {
      const result = await fetchRecommendedViaResumeVSearch({
        userId: input.userId,
        artifactId: artifact.artifactId,
        profileTargetRoles: targetRoles,
        filters: mergedFilters,
        semanticQuery: semanticQuery || undefined,
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
        headline: profile?.headline,
        targetRoles,
        resumeText: profile?.resumeText,
        parsedData,
        careerMotivation: profile?.careerMotivation,
        priorities: profile?.priorities ?? [],
        employmentStatus: profile?.employmentStatus,
        jobTimeline: profile?.jobTimeline,
        semanticQuery: semanticQuery || undefined,
      }) ?? trimVSearchQuery(targetRoles.join(", "));

    if (summaryQuery) {
      try {
        const summary = await fetchRecommendedViaProfileSummary({
          userId: input.userId,
          query: summaryQuery,
          profileTargetRoles: targetRoles,
          filters: mergedFilters,
          maxJobs: RECOMMENDED_FETCH_POOL,
        });
        if (summary.sources.length) {
          sources = summary.sources;
          companyCount = summary.companyCount;
          trackedWithMatches = summary.trackedWithMatches;
          matchMode = artifact.artifactId ? "profile_summary" : "profile_summary";
          notice = artifact.artifactId
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
      profileTargetRoles: targetRoles,
      filters: mergedFilters,
      maxJobs: maxJobs * 2,
      preferCache,
    });
    if (tracked.sources.length) {
      sources = tracked.sources;
      companyCount = tracked.companyCount;
      trackedWithMatches = tracked.trackedWithMatches;
      matchMode = "tracked";
      notice =
        notice ??
        (artifact.artifactId
          ? "Showing open roles at your tracked companies."
          : "Track companies for a ranking boost — showing watchlist matches.");
    }
  }

  if (!sources.length && targetRoles.length) {
    const roles = await fetchRecommendedFromProfileRoles({
      profileTargetRoles: targetRoles,
      filters: mergedFilters,
      semanticQuery: semanticQuery || undefined,
      maxJobs: maxJobs * 2,
    });
    sources = roles.sources;
    matchMode = "profile_roles";
    notice = notice ?? "Showing roles that match your target titles.";
  }

  if (!sources.length) return null;

  if (defaultFeed) {
    const beforeLocation = sources.length;
    sources = filterSourcesByLocationPreference(sources, { profileLocation, priorities });
    if (beforeLocation > 0 && !sources.length) {
      notice =
        notice ??
        "No roles matched your location preferences — broaden location under Filters or enable relocation in Match preferences.";
    }
  }

  if (!sources.length) return null;

  const jobs = await enrichAndRank(sources, resumeText, input.userId, maxJobs);

  return {
    jobs,
    matchMode,
    companyCount,
    trackedWithMatches,
    notice,
    artifactReEmbedded: artifact.reEmbedded,
    resumeVSearch,
    effectiveFilters: mergedFilters,
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

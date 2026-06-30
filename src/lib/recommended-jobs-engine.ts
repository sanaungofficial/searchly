import { isHirebaseConfigured } from "@/lib/hirebase";
import {
  profileSearchConstraints,
  exclusionPrefsFromSearchPreferences,
} from "@/lib/profile-search-constraints";
import {
  RECOMMENDED_SNAPSHOT_MAX_JOBS,
  type RecommendedJobSnapshotPayload,
} from "@/lib/recommended-jobs-config";
import { executeUnifiedJobsSearch } from "@/lib/unified-jobs-search";
import {
  buildRoleTitlePreferencesFromProfile,
  hasRoleTitlePreferenceSignals,
  type RoleTitlePreferences,
} from "@/lib/role-title-preferences";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData, type ParsedResumeData } from "@/lib/resume-parse";
import { parseSearchPreferences } from "@/lib/search-preferences";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { prisma } from "@/lib/prisma";

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

async function loadProfileContext(userId: string) {
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

  const experienceLevel =
    typeof parsedData === "object" &&
    parsedData &&
    "experienceLevel" in parsedData &&
    typeof (parsedData as { experienceLevel?: unknown }).experienceLevel === "string"
      ? (parsedData as { experienceLevel: string }).experienceLevel
      : null;

  const constraints = profileSearchConstraints({
    profileLocation: parsedData.location ?? null,
    targetMarket: profile?.targetMarket ?? null,
    priorities: profile?.priorities ?? [],
    experienceLevel,
    targetRoles: profile?.targetRoles ?? [],
    prioritizedCategories: profile?.prioritizedCategories ?? [],
    searchPreferences,
  });

  return { profile, parsedData, searchPreferences, constraints };
}

/** Profile-driven recommended feed — structured Hirebase search, no resume vsearch. */
export async function generateRecommendedJobsForUser(
  input: GenerateRecommendedInput,
): Promise<GenerateRecommendedResult | null> {
  if (!isHirebaseConfigured()) return null;

  const { searchPreferences, constraints } = await loadProfileContext(input.userId);
  const maxJobs = input.maxJobs ?? RECOMMENDED_SNAPSHOT_MAX_JOBS;

  const result = await executeUnifiedJobsSearch({
    userId: input.userId,
    filters: constraints,
    mode: "recommended",
    maxJobs,
    exclusions: exclusionPrefsFromSearchPreferences(searchPreferences),
  });

  if (!result?.jobs.length) return null;

  return {
    jobs: result.jobs,
    matchMode: result.matchMode,
    companyCount: result.companyCount,
    trackedWithMatches: result.trackedWithMatches,
    notice: result.notice,
    effectiveFilters: result.filtersApplied,
    resumeVSearch: false,
    artifactReEmbedded: false,
  };
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
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const roleTitlePreferences = buildRoleTitlePreferencesFromProfile(profile);
  const targetRoles = roleTitlePreferences.targetRoles ?? [];
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const resumeAsset = await findResumeAssetForUser(userId);
  return hasProfileSignals({
    targetRoles,
    roleTitlePreferences,
    resumeAssetUrl: resumeAsset?.url ?? null,
    profileResumeUrl: profile?.resumeUrl,
    resumeText: profile?.resumeText ?? "",
    parsedData,
  });
}

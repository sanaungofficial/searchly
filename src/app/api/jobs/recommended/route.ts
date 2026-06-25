import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { parseVectorSearchFilters } from "@/lib/jobs-search-filters";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import {
  fetchRecommendedFromProfileRoles,
  fetchRecommendedFromTrackedCompanies,
  fetchRecommendedViaResumeVSearch,
} from "@/lib/recommended-jobs-fallback";
import { profileTextForMatchReasons, trimVSearchQuery } from "@/lib/profile-vsearch-query";
import { ensureHirebaseArtifactForUser, findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData, type ParsedResumeData } from "@/lib/resume-parse";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { formatApiErrorMessage } from "@/lib/api-error-message";

async function parseRecommendedFilters(request: Request): Promise<{
  filters: VectorSearchFilters;
  preferCache: boolean;
  forceRefresh: boolean;
}> {
  if (request.method === "GET") {
    return { filters: {}, preferCache: true, forceRefresh: false };
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const filters = parseVectorSearchFilters(body);
    const preferCache = body.preferCache !== false;
    const forceRefresh = body.forceRefresh === true;
    return { filters, preferCache, forceRefresh };
  } catch {
    return { filters: {}, preferCache: true, forceRefresh: false };
  }
}

function profileHasResumeSignal(input: {
  resumeAssetUrl: string | null;
  profileResumeUrl: string | null | undefined;
  resumeText: string;
  parsedData: ParsedResumeData | null;
}): boolean {
  if (input.resumeAssetUrl || input.profileResumeUrl) return true;
  if (input.resumeText.trim().length >= 40) return true;
  return (input.parsedData?.workExperience?.length ?? 0) > 0;
}

function profileHasRoleSignal(targetRoles: string[], filters: VectorSearchFilters): boolean {
  return targetRoles.length > 0 || (filters.jobTitles?.length ?? 0) > 0;
}

type FallbackBundle = {
  matchMode: "tracked" | "profile_roles";
  companyCount?: number;
  trackedWithMatches?: number;
  notice?: string;
};

async function loadTrackedSources(input: {
  dbUserId: string;
  targetRoles: string[];
  filters: VectorSearchFilters;
  preferCache: boolean;
}) {
  let result = await fetchRecommendedFromTrackedCompanies({
    userId: input.dbUserId,
    profileTargetRoles: input.targetRoles,
    filters: input.filters,
    maxJobs: VECTOR_SEARCH_RESULTS_MAX,
    preferCache: input.preferCache,
  });

  if (!result.sources.length && input.preferCache) {
    result = await fetchRecommendedFromTrackedCompanies({
      userId: input.dbUserId,
      profileTargetRoles: input.targetRoles,
      filters: input.filters,
      maxJobs: VECTOR_SEARCH_RESULTS_MAX,
      preferCache: false,
    });
  }

  return result;
}

async function respondWithFallbacks(input: {
  dbUserId: string;
  targetRoles: string[];
  filters: VectorSearchFilters;
  resumeText: string;
  preferCache: boolean;
  semanticQuery: string;
  artifactReEmbedded?: boolean;
  resumeMatchUnavailable?: boolean;
}) {
  const tracked = await loadTrackedSources({
    dbUserId: input.dbUserId,
    targetRoles: input.targetRoles,
    filters: input.filters,
    preferCache: input.preferCache,
  });

  if (tracked.sources.length) {
    const jobs = await enrichRecommendedSources(tracked.sources, input.resumeText, {
      heuristicOnly: !process.env.ANTHROPIC_API_KEY,
    });

    const meta: FallbackBundle = {
      matchMode: "tracked",
      companyCount: tracked.companyCount,
      trackedWithMatches: tracked.trackedWithMatches,
    };
    if (input.resumeMatchUnavailable) {
      meta.notice =
        tracked.companyCount === 0
          ? undefined
          : "Resume matching is unavailable — showing open roles at your tracked companies.";
    }

    return NextResponse.json({
      jobs,
      totalCount: jobs.length,
      page: 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode: meta.matchMode,
      companyCount: meta.companyCount,
      trackedWithMatches: meta.trackedWithMatches,
      filtersApplied: input.filters,
      artifactReEmbedded: input.artifactReEmbedded,
      resumeVSearch: false,
      notice: meta.notice,
    });
  }

  const profileRoles = await fetchRecommendedFromProfileRoles({
    profileTargetRoles: input.targetRoles,
    filters: input.filters,
    semanticQuery: input.semanticQuery || undefined,
    maxJobs: VECTOR_SEARCH_RESULTS_MAX,
  });

  if (profileRoles.sources.length) {
    const jobs = await enrichRecommendedSources(profileRoles.sources, input.resumeText, {
      heuristicOnly: !process.env.ANTHROPIC_API_KEY,
    });

    return NextResponse.json({
      jobs,
      totalCount: jobs.length,
      page: 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode: "profile_roles" as const,
      filtersApplied: input.filters,
      artifactReEmbedded: input.artifactReEmbedded,
      resumeVSearch: false,
      notice:
        "Showing roles that match your target titles. Track companies on the Companies page for tighter, resume-aware matches.",
    });
  }

  return null;
}

async function handleRecommended(request: Request) {
  if (!isHirebaseConfigured()) {
    return NextResponse.json({ error: "Hirebase is not configured on this environment." }, { status: 503 });
  }

  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
  const { filters, preferCache } = await parseRecommendedFilters(request);
  const semanticQuery = trimVSearchQuery(filters.semanticQuery ?? "");
  const searchFilters = semanticQuery ? { ...filters, semanticQuery } : filters;

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
    targetSalary: typeof profile?.targetSalary === "number" ? profile.targetSalary : null,
  });

  const resumeAsset = await findResumeAssetForUser(dbUser.id);
  const hasResumeSignal = profileHasResumeSignal({
    resumeAssetUrl: resumeAsset?.url ?? null,
    profileResumeUrl: profile?.resumeUrl,
    resumeText,
    parsedData,
  });
  const hasRoleSignal = profileHasRoleSignal(targetRoles, searchFilters);

  const artifact = await ensureHirebaseArtifactForUser(dbUser.id);
  const resumeMatchUnavailable = !artifact.artifactId;

  const fallbackInput = {
    dbUserId: dbUser.id,
    targetRoles,
    filters: searchFilters,
    resumeText,
    preferCache,
    semanticQuery,
    artifactReEmbedded: artifact.reEmbedded,
    resumeMatchUnavailable,
  };

  if (!artifact.artifactId) {
    const fallback = await respondWithFallbacks(fallbackInput);
    if (fallback) return fallback;

    if (!hasResumeSignal && !hasRoleSignal) {
      return NextResponse.json(
        {
          error: "Add target roles in your profile or upload a resume to see recommendations.",
          needsResume: true,
          needsProfile: true,
          hint: "Set target roles under Profile → About, or upload a resume under Profile → Assets.",
        },
        { status: 404 },
      );
    }

    const trackedOnly = await loadTrackedSources({
      dbUserId: dbUser.id,
      targetRoles,
      filters: searchFilters,
      preferCache: false,
    });

    if (trackedOnly.companyCount === 0) {
      return NextResponse.json(
        {
          error: "Track companies on the Companies page to see recommended roles at those employers.",
          needsCompanies: true,
          needsResume: !hasResumeSignal,
          hint: "Add dream employers on Companies, then refresh matching roles here.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        error:
          "No matching roles yet — refresh job scans on your tracked companies or broaden filters.",
        needsResume: false,
        needsCompanies: false,
        companyCount: trackedOnly.companyCount,
        hint: "Open a tracked company and run Refresh roles, then try again.",
      },
      { status: 404 },
    );
  }

  try {
    const result = await fetchRecommendedViaResumeVSearch({
      userId: dbUser.id,
      artifactId: artifact.artifactId,
      profileTargetRoles: targetRoles,
      filters: searchFilters,
      semanticQuery: semanticQuery || undefined,
      maxJobs: VECTOR_SEARCH_RESULTS_MAX,
    });

    const needsCompanies = result.companyCount === 0;

    if (!result.sources.length) {
      const fallback = await respondWithFallbacks(fallbackInput);
      if (fallback) return fallback;

      return NextResponse.json(
        {
          error: needsCompanies
            ? "Track companies on the Companies page to see recommended roles."
            : semanticQuery
              ? "No resume-matched roles at your tracked companies for this search — try different keywords or filters."
              : "No resume-matched roles at your tracked companies — try broadening filters or track more companies.",
          needsCompanies,
          needsProfile: !hasRoleSignal,
          needsResume: false,
          companyCount: result.companyCount,
          artifactReEmbedded: artifact.reEmbedded,
          hint: needsCompanies
            ? "Add employers on the Companies page first."
            : "Refresh roles on tracked companies or loosen filters.",
        },
        { status: 404 },
      );
    }

    const jobs = await enrichRecommendedSources(result.sources, resumeText, {
      heuristicOnly: !process.env.ANTHROPIC_API_KEY,
    });

    return NextResponse.json({
      jobs,
      totalCount: jobs.length,
      page: 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode: "resume" as const,
      companyCount: result.companyCount,
      trackedWithMatches: result.trackedWithMatches,
      filtersApplied: searchFilters,
      artifactReEmbedded: artifact.reEmbedded,
      resumeVSearch: true,
    });
  } catch (err) {
    const fallback = await respondWithFallbacks(fallbackInput);
    if (fallback) return fallback;

    const msg = formatApiErrorMessage(err, "Could not load recommended jobs.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** Resume-matched roles at tracked companies via Hirebase `/v2/jobs/vsearch`. */
export async function GET(request: Request) {
  return handleRecommended(request);
}

export async function POST(request: Request) {
  return handleRecommended(request);
}

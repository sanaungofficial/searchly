import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { parseVectorSearchFilters } from "@/lib/jobs-search-filters";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import {
  fetchRecommendedFromTrackedCompanies,
  fetchRecommendedViaResumeVSearch,
} from "@/lib/recommended-jobs-fallback";
import { profileTextForMatchReasons, trimVSearchQuery } from "@/lib/profile-vsearch-query";
import { ensureHirebaseArtifactForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
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

async function respondWithTrackedFallback(input: {
  dbUserId: string;
  targetRoles: string[];
  filters: VectorSearchFilters;
  resumeText: string;
  preferCache: boolean;
  artifactReEmbedded?: boolean;
}) {
  const result = await fetchRecommendedFromTrackedCompanies({
    userId: input.dbUserId,
    profileTargetRoles: input.targetRoles,
    filters: input.filters,
    maxJobs: VECTOR_SEARCH_RESULTS_MAX,
    preferCache: input.preferCache,
  });

  if (!result.sources.length) {
    return null;
  }

  const jobs = await enrichRecommendedSources(result.sources, input.resumeText, {
    heuristicOnly: !process.env.ANTHROPIC_API_KEY,
  });

  return NextResponse.json({
    jobs,
    totalCount: jobs.length,
    page: 1,
    limit: VECTOR_SEARCH_RESULTS_MAX,
    totalPages: 1,
    matchMode: "tracked" as const,
    companyCount: result.companyCount,
    trackedWithMatches: result.trackedWithMatches,
    filtersApplied: input.filters,
    artifactReEmbedded: input.artifactReEmbedded,
    resumeVSearch: false,
  });
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

  const primaryAsset = await prisma.userAsset.findFirst({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
  });
  const hasResumeFile = !!(primaryAsset?.url || profile?.resumeUrl);

  const artifact = await ensureHirebaseArtifactForUser(dbUser.id);
  if (!artifact.artifactId) {
    if (hasResumeFile || artifact.embedFailed) {
      const fallback = await respondWithTrackedFallback({
        dbUserId: dbUser.id,
        targetRoles,
        filters: searchFilters,
        resumeText,
        preferCache,
        artifactReEmbedded: artifact.reEmbedded,
      });
      if (fallback) return fallback;
    }

    if (!hasResumeFile) {
      return NextResponse.json(
        {
          error: "Upload a resume from Profile → Assets to see personalized recommendations.",
          needsResume: true,
          needsProfile: targetRoles.length === 0 && !filters.jobTitles?.length,
        },
        { status: 404 },
      );
    }

    const fallback = await respondWithTrackedFallback({
      dbUserId: dbUser.id,
      targetRoles,
      filters: searchFilters,
      resumeText,
      preferCache,
      artifactReEmbedded: artifact.reEmbedded,
    });
    if (fallback) return fallback;

    return NextResponse.json(
      {
        error: "No roles found at your tracked companies — try tracking more companies or broadening filters.",
        needsResume: false,
        needsProfile: targetRoles.length === 0 && !filters.jobTitles?.length,
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
      const fallback = await respondWithTrackedFallback({
        dbUserId: dbUser.id,
        targetRoles,
        filters: searchFilters,
        resumeText,
        preferCache,
        artifactReEmbedded: artifact.reEmbedded,
      });
      if (fallback) return fallback;

      return NextResponse.json(
        {
          error: needsCompanies
            ? "Track companies on the Companies page to see recommended roles."
            : semanticQuery
              ? "No resume-matched roles at your tracked companies for this search — try different keywords or filters."
              : "No resume-matched roles at your tracked companies — try broadening filters or track more companies.",
          needsCompanies,
          needsProfile: targetRoles.length === 0 && !filters.jobTitles?.length,
          needsResume: false,
          companyCount: result.companyCount,
          artifactReEmbedded: artifact.reEmbedded,
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
    const fallback = await respondWithTrackedFallback({
      dbUserId: dbUser.id,
      targetRoles,
      filters: searchFilters,
      resumeText,
      preferCache,
      artifactReEmbedded: artifact.reEmbedded,
    });
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

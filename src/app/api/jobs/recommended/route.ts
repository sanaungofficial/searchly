import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { parseVectorSearchFilters } from "@/lib/jobs-search-filters";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import {
  fetchRecommendedFromTrackedCompanies,
  fetchSemanticSearchOnTrackedCompanies,
} from "@/lib/recommended-jobs-fallback";
import { profileTextForMatchReasons, trimVSearchQuery } from "@/lib/profile-vsearch-query";
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

async function handleRecommended(request: Request) {
  if (!isHirebaseConfigured()) {
    return NextResponse.json({ error: "Hirebase is not configured on this environment." }, { status: 503 });
  }

  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
  const { filters, preferCache, forceRefresh } = await parseRecommendedFilters(request);
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
    targetSalary: profile?.targetSalary,
  });

  try {
    let matchMode: "company_roles" | "semantic_scoped" | "semantic_global" = "company_roles";
    let companyCount = 0;
    let trackedWithMatches = 0;
    let needsCompanies = false;

    if (semanticQuery) {
      const searchResult = await fetchSemanticSearchOnTrackedCompanies({
        userId: dbUser.id,
        profileTargetRoles: targetRoles,
        query: semanticQuery,
        filters: searchFilters,
      });
      matchMode = searchResult.scoped ? "semantic_scoped" : "semantic_global";

      if (!searchResult.sources.length) {
        return NextResponse.json(
          {
            error: searchResult.scoped
              ? "No jobs matched your search at your tracked companies. Try different keywords or track more companies."
              : "No jobs matched your search. Try a shorter phrase.",
          },
          { status: 404 },
        );
      }

      const jobs = await enrichRecommendedSources(searchResult.sources, resumeText, { heuristicOnly: true });
      return NextResponse.json({
        jobs,
        totalCount: jobs.length,
        page: 1,
        limit: VECTOR_SEARCH_RESULTS_MAX,
        totalPages: 1,
        matchMode,
        filtersApplied: searchFilters,
      });
    }

    const result = await fetchRecommendedFromTrackedCompanies({
      userId: dbUser.id,
      profileTargetRoles: targetRoles,
      filters: searchFilters,
      maxJobs: VECTOR_SEARCH_RESULTS_MAX,
      preferCache: preferCache && !forceRefresh,
    });

    companyCount = result.companyCount;
    trackedWithMatches = result.trackedWithMatches;
    needsCompanies = result.companyCount === 0;

    if (!result.sources.length) {
      return NextResponse.json(
        {
          error: needsCompanies
            ? "Track companies on the Companies page to see recommended roles."
            : "No matching roles with these filters — try broadening filters or refresh matching roles on Companies.",
          needsCompanies,
          needsProfile: targetRoles.length === 0 && !filters.jobTitles?.length,
          companyCount,
        },
        { status: 404 },
      );
    }

    const jobs = await enrichRecommendedSources(result.sources, resumeText, { heuristicOnly: true });

    return NextResponse.json({
      jobs,
      totalCount: jobs.length,
      page: 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode,
      companyCount,
      trackedWithMatches,
      filtersApplied: searchFilters,
    });
  } catch (err) {
    const msg = formatApiErrorMessage(err, "Could not load recommended jobs.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** Matching roles at tracked companies — optional keyword search in the same endpoint. */
export async function GET(request: Request) {
  return handleRecommended(request);
}

export async function POST(request: Request) {
  return handleRecommended(request);
}

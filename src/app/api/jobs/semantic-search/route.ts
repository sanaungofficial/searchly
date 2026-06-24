import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { parseVectorSearchFilters } from "@/lib/jobs-search-filters";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import { fetchSemanticSearchOnTrackedCompanies } from "@/lib/recommended-jobs-fallback";
import { profileTextForMatchReasons, trimVSearchQuery } from "@/lib/profile-vsearch-query";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { formatApiErrorMessage } from "@/lib/api-error-message";

/** Keyword / semantic search — not resume-based. Scoped to tracked companies when available. */
export async function POST(request: Request) {
  if (!isHirebaseConfigured()) {
    return NextResponse.json({ error: "Hirebase is not configured on this environment." }, { status: 503 });
  }

  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });

  let rawBody: Record<string, unknown> = {};
  try {
    rawBody = (await request.json()) as Record<string, unknown>;
  } catch {
    rawBody = {};
  }

  const filters = parseVectorSearchFilters(rawBody);
  const query = trimVSearchQuery(filters.semanticQuery ?? "");
  if (!query) {
    return NextResponse.json({ error: "Enter a search phrase to find jobs." }, { status: 400 });
  }

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
    targetSalary: profile?.targetSalary,
  });

  try {
    const result = await fetchSemanticSearchOnTrackedCompanies({
      userId: dbUser.id,
      profileTargetRoles: targetRoles,
      query,
      filters: {
        ...filters,
        semanticQuery: query,
        limit: Math.min(filters.limit ?? VECTOR_SEARCH_RESULTS_MAX, VECTOR_SEARCH_RESULTS_MAX),
        page: filters.page ?? 1,
      },
    });

    if (!result.sources.length) {
      return NextResponse.json(
        {
          error: result.scoped
            ? "No jobs matched your search at your tracked companies. Try different keywords or track more companies."
            : "No jobs matched your search. Try a shorter phrase.",
        },
        { status: 404 },
      );
    }

    const jobs = await enrichRecommendedSources(result.sources, resumeText);

    return NextResponse.json({
      jobs,
      totalCount: jobs.length,
      page: filters.page ?? 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode: result.scoped ? ("semantic_scoped" as const) : ("semantic_global" as const),
      filtersApplied: filters,
    });
  } catch (err) {
    const msg = formatApiErrorMessage(err, "Search failed.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

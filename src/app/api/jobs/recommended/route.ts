import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { parseVectorSearchFilters } from "@/lib/jobs-search-filters";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import { fetchRecommendedFromTrackedCompanies } from "@/lib/recommended-jobs-fallback";
import { profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { formatApiErrorMessage } from "@/lib/api-error-message";

async function parseRecommendedFilters(request: Request): Promise<VectorSearchFilters> {
  if (request.method === "GET") return {};
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const filters = parseVectorSearchFilters(body);
    delete filters.semanticQuery;
    return filters;
  } catch {
    return {};
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
  const filters = await parseRecommendedFilters(request);

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
    const result = await fetchRecommendedFromTrackedCompanies({
      userId: dbUser.id,
      profileTargetRoles: targetRoles,
      filters,
      maxJobs: VECTOR_SEARCH_RESULTS_MAX,
    });

    if (!result.sources.length) {
      return NextResponse.json(
        {
          error:
            result.companyCount === 0
              ? "Track companies on the Companies page to see recommended roles."
              : "No matching roles with these filters — try broadening filters or refresh matching roles on Companies.",
          needsCompanies: result.companyCount === 0,
          needsProfile: targetRoles.length === 0 && !filters.jobTitles?.length,
          companyCount: result.companyCount,
        },
        { status: 404 },
      );
    }

    const jobs = await enrichRecommendedSources(result.sources, resumeText);

    return NextResponse.json({
      jobs,
      totalCount: jobs.length,
      page: 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode: "company_roles" as const,
      companyCount: result.companyCount,
      trackedWithMatches: result.trackedWithMatches,
      filtersApplied: filters,
    });
  } catch (err) {
    const msg = formatApiErrorMessage(err, "Could not load recommended jobs.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** Matching roles at tracked companies — same logic as Companies drawer. No resume embed. */
export async function GET(request: Request) {
  return handleRecommended(request);
}

export async function POST(request: Request) {
  return handleRecommended(request);
}

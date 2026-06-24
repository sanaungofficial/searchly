import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured } from "@/lib/hirebase";
import { enrichRecommendedSources } from "@/lib/jobs-search-response";
import { fetchRecommendedFromTrackedCompanies } from "@/lib/recommended-jobs-fallback";
import { profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { formatApiErrorMessage } from "@/lib/api-error-message";

/** Matching roles at tracked companies — same logic as Companies drawer. No resume embed. */
export async function GET(request: Request) {
  if (!isHirebaseConfigured()) {
    return NextResponse.json({ error: "Hirebase is not configured on this environment." }, { status: 503 });
  }

  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
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
    const result = await fetchRecommendedFromTrackedCompanies({
      userId: dbUser.id,
      profileTargetRoles: targetRoles,
      maxJobs: VECTOR_SEARCH_RESULTS_MAX,
    });

    if (!result.sources.length) {
      return NextResponse.json(
        {
          error:
            result.companyCount === 0
              ? "Track companies on the Companies page to see recommended roles."
              : "No matching roles yet — open each tracked company and refresh matching roles, or add target roles on Profile.",
          needsCompanies: result.companyCount === 0,
          needsProfile: targetRoles.length === 0,
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
    });
  } catch (err) {
    const msg = formatApiErrorMessage(err, "Could not load recommended jobs.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}

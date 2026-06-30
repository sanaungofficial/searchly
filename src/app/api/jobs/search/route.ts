import { isHirebaseConfigured } from "@/lib/hirebase";
import { parseVectorSearchFilters } from "@/lib/jobs-search-filters";
import {
  exclusionPrefsFromSearchPreferences,
} from "@/lib/profile-search-constraints";
import { executeUnifiedJobsSearch } from "@/lib/unified-jobs-search";
import { applyRoleTitlePreferencesToMatchedJobs } from "@/lib/recommended-jobs-ranking";
import { buildRoleTitlePreferencesFromProfile } from "@/lib/role-title-preferences";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { parseSearchPreferences } from "@/lib/search-preferences";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { formatApiErrorMessage } from "@/lib/api-error-message";

export const maxDuration = 120;

/** User-initiated filter search — honest counts, no silent filter relaxation. */
export async function POST(request: Request) {
  if (!isHirebaseConfigured()) {
    return NextResponse.json({ error: "Job search is not configured on this environment." }, { status: 503 });
  }

  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let rawBody: Record<string, unknown> = {};
  try {
    rawBody = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const filters = parseVectorSearchFilters(rawBody);
  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const searchPreferences = parseSearchPreferences(
    parsedData && typeof parsedData === "object"
      ? (parsedData as { searchPreferences?: unknown }).searchPreferences
      : undefined,
  );

  try {
    const result = await executeUnifiedJobsSearch({
      userId: dbUser.id,
      filters,
      mode: "search",
      maxJobs: Math.min(filters.limit ?? VECTOR_SEARCH_RESULTS_MAX, VECTOR_SEARCH_RESULTS_MAX),
      exclusions: exclusionPrefsFromSearchPreferences(searchPreferences),
    });

    const roleTitlePreferences = buildRoleTitlePreferencesFromProfile(profile);
    const jobs = applyRoleTitlePreferencesToMatchedJobs(result?.jobs ?? [], roleTitlePreferences);

    return NextResponse.json({
      jobs,
      totalCount: jobs.length,
      page: filters.page ?? 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode: result?.matchMode ?? "profile_roles",
      filtersApplied: result?.filtersApplied ?? filters,
      notice: result?.notice,
      companyCount: result?.companyCount ?? 0,
      trackedWithMatches: result?.trackedWithMatches ?? 0,
    });
  } catch (err) {
    const msg = formatApiErrorMessage(err, "Could not run job search.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

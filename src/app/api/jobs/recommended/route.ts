import { isHirebaseConfigured } from "@/lib/hirebase";
import { parseVectorSearchFilters } from "@/lib/jobs-search-filters";
import {
  generateRecommendedJobsForUser,
  hasProfileSignals,
} from "@/lib/recommended-jobs-engine";
import { isDefaultRecommendedFilters } from "@/lib/profile-preference-filters";
import {
  RECOMMENDED_MATCH_SCORE_FLOOR,
  RECOMMENDED_SNAPSHOT_MAX_JOBS,
  utcSnapshotDate,
} from "@/lib/recommended-jobs-config";
import {
  persistRecommendedSnapshot,
  readRecommendedSnapshot,
  recordManualRefresh,
  invalidateRecommendedSnapshotForUser,
} from "@/lib/recommended-jobs-snapshot";
import { applyRoleTitlePreferencesToMatchedJobs } from "@/lib/recommended-jobs-ranking";
import { buildRoleTitlePreferencesFromProfile } from "@/lib/role-title-preferences";
import { trimVSearchQuery } from "@/lib/profile-vsearch-query";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { readClientUserIdFromRequest, resolveScopedDbUser } from "@/lib/admin-client-subject";
import { formatApiErrorMessage } from "@/lib/api-error-message";

export const maxDuration = 120;

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

function snapshotResponse(
  payload: Awaited<ReturnType<typeof readRecommendedSnapshot>>,
  extras: Record<string, unknown> = {},
) {
  if (!payload) return null;
  return NextResponse.json({
    jobs: payload.jobs,
    totalCount: payload.jobs.length,
    page: 1,
    limit: VECTOR_SEARCH_RESULTS_MAX,
    totalPages: 1,
    matchMode: payload.matchMode,
    companyCount: payload.companyCount,
    trackedWithMatches: payload.trackedWithMatches,
    snapshotDate: utcSnapshotDate(),
    generatedAt: payload.generatedAt.toISOString(),
    fromSnapshot: true,
    scoreFloor: RECOMMENDED_MATCH_SCORE_FLOOR,
    ...extras,
  });
}

async function handleRecommended(request: Request) {
  if (!isHirebaseConfigured()) {
    return NextResponse.json({ error: "Job search is not configured on this environment." }, { status: 503 });
  }

  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminReviewClientId = readClientUserIdFromRequest(request);

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const roleTitlePreferences = buildRoleTitlePreferencesFromProfile(profile);
  const targetRoles = roleTitlePreferences.targetRoles ?? [];
  const { filters, preferCache, forceRefresh } = await parseRecommendedFilters(request);
  const semanticQuery = trimVSearchQuery(filters.semanticQuery ?? "");
  // Default personalized feed: profile prefs drive matching server-side — not as Hirebase pre-filters.
  const searchFilters = semanticQuery
    ? { ...filters, semanticQuery }
    : isDefaultRecommendedFilters(filters)
      ? filters
      : {
          page: filters.page,
          limit: filters.limit,
          accuracy: filters.accuracy,
        };
  const defaultFeed = !semanticQuery && isDefaultRecommendedFilters(searchFilters);
  const snapshotDate = utcSnapshotDate();

  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const resumeAsset = await findResumeAssetForUser(dbUser.id);
  const hasSignals = hasProfileSignals({
    targetRoles,
    roleTitlePreferences,
    resumeAssetUrl: resumeAsset?.url ?? null,
    profileResumeUrl: profile?.resumeUrl,
    resumeText: profile?.resumeText ?? "",
    parsedData,
  });

  if (!hasSignals && !semanticQuery) {
    return NextResponse.json(
      {
        error: "Add target roles in your profile or upload a resume to see recommendations.",
        needsResume: true,
        needsProfile: true,
        hint: "Set target roles under Profile → About, or upload a resume under Profile → Resumes.",
      },
      { status: 404 },
    );
  }

  // Daily snapshot is for the member's own feed. Admin client review always regenerates live
  // so roles and heuristic scores match the reviewed profile (not a stale or wrong-user cache).
  if (!forceRefresh && defaultFeed && !adminReviewClientId) {
    try {
      const cached = await readRecommendedSnapshot(dbUser.id, snapshotDate);
      if (cached?.jobs.length) {
        const jobs = applyRoleTitlePreferencesToMatchedJobs(cached.jobs, roleTitlePreferences);
        return snapshotResponse({ ...cached, jobs }, { filtersApplied: searchFilters });
      }
    } catch (err) {
      console.warn("[recommended] snapshot read failed:", err);
    }
  }

  try {
    const result = await generateRecommendedJobsForUser({
      userId: dbUser.id,
      filters: searchFilters,
      preferCache: forceRefresh ? false : preferCache,
      maxJobs: RECOMMENDED_SNAPSHOT_MAX_JOBS,
    });

    if (!result?.jobs.length) {
      return NextResponse.json(
        {
          error: "Could not load roles right now — try Refresh in a moment.",
          needsProfile: targetRoles.length === 0,
          hint: "If this keeps happening, check target roles under Profile or broaden filters.",
          matchMode: result?.matchMode,
          effectiveFilters: result?.effectiveFilters,
          jobs: [],
          totalCount: 0,
        },
        { status: 404 },
      );
    }

    if (defaultFeed) {
      try {
        await persistRecommendedSnapshot({
          userId: dbUser.id,
          snapshotDate,
          payload: result,
          manualRefresh: forceRefresh,
        });
        if (forceRefresh) await recordManualRefresh(dbUser.id);
      } catch (err) {
        console.warn("[recommended] snapshot persist failed:", err);
      }
    }

    return NextResponse.json({
      jobs: applyRoleTitlePreferencesToMatchedJobs(result.jobs, roleTitlePreferences),
      totalCount: result.jobs.length,
      page: 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode: result.matchMode,
      companyCount: result.companyCount,
      trackedWithMatches: result.trackedWithMatches,
      filtersApplied: result.effectiveFilters ?? searchFilters,
      effectiveFilters: result.effectiveFilters ?? searchFilters,
      artifactReEmbedded: result.artifactReEmbedded,
      resumeVSearch: result.resumeVSearch,
      notice: result.notice,
      snapshotDate,
      generatedAt: new Date().toISOString(),
      fromSnapshot: false,
      scoreFloor: RECOMMENDED_MATCH_SCORE_FLOOR,
    });
  } catch (err) {
    const msg = formatApiErrorMessage(err, "Could not load recommended jobs.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** Personalized recommended roles — daily snapshot with live refresh fallback. */
export async function GET(request: Request) {
  return handleRecommended(request);
}

export async function POST(request: Request) {
  return handleRecommended(request);
}

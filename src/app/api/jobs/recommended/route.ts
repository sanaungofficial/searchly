import { isHirebaseConfigured } from "@/lib/hirebase";
import {
  generateRecommendedJobsForUser,
  hasProfileSignals,
} from "@/lib/recommended-jobs-engine";
import {
  RECOMMENDED_MATCH_SCORE_FLOOR,
  RECOMMENDED_SNAPSHOT_MAX_JOBS,
  utcSnapshotDate,
} from "@/lib/recommended-jobs-config";
import {
  persistRecommendedSnapshot,
  readRecommendedSnapshot,
  recordManualRefresh,
} from "@/lib/recommended-jobs-snapshot";
import { applyRoleTitlePreferencesToMatchedJobs } from "@/lib/recommended-jobs-ranking";
import { filterOutPipelineJobs, loadUserPipelineDedupeKeys } from "@/lib/pipeline-job-dedupe";
import { buildRoleTitlePreferencesFromProfile } from "@/lib/role-title-preferences";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { readClientUserIdFromRequest, resolveScopedDbUser } from "@/lib/admin-client-subject";
import { formatApiErrorMessage } from "@/lib/api-error-message";

export const maxDuration = 120;

async function parseRecommendedOptions(request: Request): Promise<{
  preferCache: boolean;
  forceRefresh: boolean;
}> {
  if (request.method === "GET") {
    return { preferCache: true, forceRefresh: false };
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    return {
      preferCache: body.preferCache !== false,
      forceRefresh: body.forceRefresh === true,
    };
  } catch {
    return { preferCache: true, forceRefresh: false };
  }
}

function snapshotResponse(
  payload: Awaited<ReturnType<typeof readRecommendedSnapshot>>,
  extras: Record<string, unknown> = {},
) {
  if (!payload) return null;
  return NextResponse.json({
    jobs: payload.jobs,
    reserveJobs: [],
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
  const { preferCache, forceRefresh } = await parseRecommendedOptions(request);
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

  if (!hasSignals) {
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
  if (!forceRefresh && !adminReviewClientId) {
    try {
      const cached = await readRecommendedSnapshot(dbUser.id, snapshotDate);
      if (cached?.jobs.length) {
        const pipelineKeys = await loadUserPipelineDedupeKeys(dbUser.id);
        const visibleJobs = filterOutPipelineJobs(cached.jobs, pipelineKeys);
        const jobs = applyRoleTitlePreferencesToMatchedJobs(visibleJobs, roleTitlePreferences);
        return snapshotResponse({ ...cached, jobs });
      }
    } catch (err) {
      console.warn("[recommended] snapshot read failed:", err);
    }
  }

  try {
    const result = await generateRecommendedJobsForUser({
      userId: dbUser.id,
      preferCache: forceRefresh ? false : preferCache,
      maxJobs: RECOMMENDED_SNAPSHOT_MAX_JOBS,
    });

    if (!result) {
      return NextResponse.json(
        {
          error: "Could not load roles right now — try Refresh in a moment.",
          needsProfile: targetRoles.length === 0,
          hint: "If this keeps happening, check target roles under Profile or broaden filters.",
          jobs: [],
          totalCount: 0,
        },
        { status: 502 },
      );
    }

    if (result.jobs.length) {
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
      reserveJobs: applyRoleTitlePreferencesToMatchedJobs(result.reserveJobs ?? [], roleTitlePreferences),
      totalCount: result.jobs.length,
      page: 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode: result.matchMode,
      companyCount: result.companyCount,
      trackedWithMatches: result.trackedWithMatches,
      filtersApplied: result.effectiveFilters,
      effectiveFilters: result.effectiveFilters,
      artifactReEmbedded: result.artifactReEmbedded,
      resumeVSearch: result.resumeVSearch,
      notice:
        result.notice ??
        (result.jobs.length === 0
          ? "No roles matched your profile filters right now — try Refresh or broaden filters under Profile."
          : undefined),
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

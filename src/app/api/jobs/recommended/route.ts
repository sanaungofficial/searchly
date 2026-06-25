import { isHirebaseConfigured } from "@/lib/hirebase";
import { parseVectorSearchFilters } from "@/lib/jobs-search-filters";
import {
  generateRecommendedJobsForUser,
  hasProfileSignals,
  isDefaultRecommendedFilters,
} from "@/lib/recommended-jobs-engine";
import {
  RECOMMENDED_MATCH_SCORE_FLOOR,
  utcSnapshotDate,
} from "@/lib/recommended-jobs-config";
import {
  canManualRefresh,
  persistRecommendedSnapshot,
  readRecommendedSnapshot,
  recordManualRefresh,
} from "@/lib/recommended-jobs-snapshot";
import { trimVSearchQuery } from "@/lib/profile-vsearch-query";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { prisma } from "@/lib/prisma";
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
    return NextResponse.json({ error: "Hirebase is not configured on this environment." }, { status: 503 });
  }

  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
  const { filters, preferCache, forceRefresh } = await parseRecommendedFilters(request);
  const semanticQuery = trimVSearchQuery(filters.semanticQuery ?? "");
  const searchFilters = semanticQuery ? { ...filters, semanticQuery } : filters;
  const defaultFeed = isDefaultRecommendedFilters(searchFilters);
  const snapshotDate = utcSnapshotDate();

  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );
  const resumeAsset = await findResumeAssetForUser(dbUser.id);
  const hasSignals = hasProfileSignals({
    targetRoles,
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
        hint: "Set target roles under Profile → About, or upload a resume under Profile → Assets.",
      },
      { status: 404 },
    );
  }

  if (!forceRefresh && defaultFeed) {
    const cached = await readRecommendedSnapshot(dbUser.id, snapshotDate);
    if (cached?.jobs.length) {
      return snapshotResponse(cached, { filtersApplied: searchFilters });
    }
  }

  if (forceRefresh && defaultFeed) {
    const gate = await canManualRefresh(dbUser.id);
    if (!gate.allowed) {
      const minutes = Math.ceil((gate.retryAfterMs ?? 0) / 60_000);
      return NextResponse.json(
        {
          error: `Manual refresh is rate-limited — try again in about ${minutes} minutes, or wait for the daily refresh.`,
          retryAfterMs: gate.retryAfterMs,
        },
        { status: 429 },
      );
    }
  }

  try {
    const result = await generateRecommendedJobsForUser({
      userId: dbUser.id,
      filters: searchFilters,
      preferCache,
    });

    if (!result?.jobs.length) {
      return NextResponse.json(
        {
          error: "No roles scored 80+ yet — broaden your target roles or check back after the daily refresh.",
          needsProfile: targetRoles.length === 0,
          hint: "We refresh recommendations daily. Try adjusting filters or tracking more companies for a ranking boost.",
          scoreFloor: RECOMMENDED_MATCH_SCORE_FLOOR,
        },
        { status: 404 },
      );
    }

    if (defaultFeed) {
      await persistRecommendedSnapshot({
        userId: dbUser.id,
        snapshotDate,
        payload: result,
        manualRefresh: forceRefresh,
      });
      if (forceRefresh) await recordManualRefresh(dbUser.id);
    }

    return NextResponse.json({
      jobs: result.jobs,
      totalCount: result.jobs.length,
      page: 1,
      limit: VECTOR_SEARCH_RESULTS_MAX,
      totalPages: 1,
      matchMode: result.matchMode,
      companyCount: result.companyCount,
      trackedWithMatches: result.trackedWithMatches,
      filtersApplied: searchFilters,
      artifactReEmbedded: result.artifactReEmbedded,
      resumeVSearch: result.resumeVSearch,
      notice: result.notice,
      snapshotDate,
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

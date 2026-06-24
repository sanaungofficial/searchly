import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured, fetchHirebaseVectorJobs } from "@/lib/hirebase";
import { enrichVectorJobsWithMatchReasons } from "@/lib/hirebase-match-reasons";
import {
  buildMinimalVSearchQuery,
  buildProfileVSearchQuery,
  isHarmfulPatternQueryError,
  profileTextForMatchReasons,
} from "@/lib/profile-vsearch-query";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { VECTOR_SEARCH_RESULTS_MAX } from "@/lib/vector-matched-job";
import { NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { formatApiErrorMessage } from "@/lib/api-error-message";

function splitCsv(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return undefined;
}

function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseFilters(body: Record<string, unknown>): VectorSearchFilters {
  const limit = num(body.limit);
  return {
    limit: limit != null ? Math.min(Math.max(1, limit), VECTOR_SEARCH_RESULTS_MAX) : undefined,
    page: num(body.page),
    offset: num(body.offset),
    accuracy: num(body.accuracy),
    topK: num(body.topK),
    minScore: num(body.minScore),
    semanticQuery:
      typeof body.semanticQuery === "string"
        ? body.semanticQuery.trim().slice(0, 400) || undefined
        : undefined,
    companyName: typeof body.companyName === "string" ? body.companyName : undefined,
    companySlug: typeof body.companySlug === "string" ? body.companySlug : undefined,
    jobSlug: typeof body.jobSlug === "string" ? body.jobSlug : undefined,
    jobBoard: typeof body.jobBoard === "string" ? body.jobBoard : undefined,
    jobTitles: splitCsv(body.jobTitles),
    keywords: splitCsv(body.keywords),
    industries: splitCsv(body.industries),
    subindustries: splitCsv(body.subindustries),
    jobCategories: splitCsv(body.jobCategories),
    jobTypes: splitCsv(body.jobTypes),
    experienceLevels: splitCsv(body.experienceLevels),
    companySizeBuckets: splitCsv(body.companySizeBuckets),
    locationTypes: splitCsv(body.locationTypes),
    locations: Array.isArray(body.locations)
      ? (body.locations as Array<{ city?: string; region?: string; country?: string }>)
      : undefined,
    datePostedFrom: typeof body.datePostedFrom === "string" ? body.datePostedFrom : undefined,
    visaSponsored: body.visaSponsored === true,
    salaryFrom: num(body.salaryFrom),
    salaryTo: num(body.salaryTo),
    yearsFrom: num(body.yearsFrom),
    yearsTo: num(body.yearsTo),
  };
}

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

  const filters = parseFilters(rawBody);
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );

  const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
  const profileInput = {
    headline: profile?.headline,
    targetRoles,
    resumeText: profile?.resumeText,
    parsedData,
    careerMotivation: profile?.careerMotivation,
    priorities: profile?.priorities ?? [],
    employmentStatus: profile?.employmentStatus,
    jobTimeline: profile?.jobTimeline,
    targetSalary: profile?.targetSalary,
    semanticQuery: filters.semanticQuery,
    filterKeywords: filters.keywords,
  };

  let query = buildProfileVSearchQuery(profileInput);
  if (!query) {
    return NextResponse.json(
      {
        error: "Add target roles or upload a resume on Profile so we can find matching jobs.",
        needsProfile: true,
      },
      { status: 404 }
    );
  }

  const jobTitles = filters.jobTitles?.length ? filters.jobTitles.slice(0, 20) : targetRoles.slice(0, 20);
  const resumeText = profileTextForMatchReasons(profileInput);

  const searchParams = {
    query,
    ...filters,
    jobTitles: jobTitles.length ? jobTitles : filters.jobTitles,
    limit: Math.min(filters.limit ?? VECTOR_SEARCH_RESULTS_MAX, VECTOR_SEARCH_RESULTS_MAX),
    page: filters.page ?? 1,
  };

  try {
    let search;
    try {
      search = await fetchHirebaseVectorJobs(searchParams);
    } catch (err) {
      if (!isHarmfulPatternQueryError(err)) throw err;
      const fallbackQuery = buildMinimalVSearchQuery(
        filters.semanticQuery ? [filters.semanticQuery, ...targetRoles] : targetRoles,
      );
      if (!fallbackQuery || fallbackQuery === query) throw err;
      search = await fetchHirebaseVectorJobs({ ...searchParams, query: fallbackQuery });
    }

    const jobs = await enrichVectorJobsWithMatchReasons({
      rawJobs: search.rawJobs,
      cachedJobs: search.jobs,
      companyNames: search.companyNames,
      resumeText,
    });

    return NextResponse.json({
      jobs,
      totalCount: search.totalCount,
      page: search.page,
      limit: search.limit,
      totalPages: search.totalPages,
      filtersApplied: {
        ...filters,
        jobTitles: jobTitles.length ? jobTitles : null,
      },
    });
  } catch (err) {
    const msg = formatApiErrorMessage(err, "Vector search failed.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

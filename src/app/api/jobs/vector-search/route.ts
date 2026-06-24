import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured, fetchHirebaseVectorJobs } from "@/lib/hirebase";
import { enrichVectorJobsWithMatchReasons } from "@/lib/hirebase-match-reasons";
import {
  buildProfileVSearchQuery,
  profileTextForMatchReasons,
} from "@/lib/profile-vsearch-query";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
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
  return {
    limit: num(body.limit),
    page: num(body.page),
    offset: num(body.offset),
    accuracy: num(body.accuracy),
    topK: num(body.topK),
    minScore: num(body.minScore),
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

function appendQueryParts(base: string, parts: string[]): string {
  const extra = parts.map((p) => p.trim()).filter(Boolean);
  if (!extra.length) return base;
  return `${base} ${extra.join(" ")}`.replace(/\s+/g, " ").trim().slice(0, 2000);
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

  const profileInput = {
    headline: profile?.headline,
    targetRoles: profile?.targetRoles ?? [],
    resumeText: profile?.resumeText,
    parsedData,
    careerMotivation: profile?.careerMotivation,
    priorities: profile?.priorities ?? [],
    employmentStatus: profile?.employmentStatus,
    jobTimeline: profile?.jobTimeline,
    targetSalary: profile?.targetSalary,
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

  const targetRoles = profile?.targetRoles ?? [];
  const jobTitles = filters.jobTitles?.length ? filters.jobTitles : targetRoles.slice(0, 3);
  const queryExtras: string[] = [];
  if (jobTitles.length) {
    queryExtras.push(`Focus on titles like ${jobTitles.join(", ")}.`);
  }
  if (filters.keywords?.length) {
    queryExtras.push(`Keywords: ${filters.keywords.join(", ")}.`);
  }
  if (filters.locationTypes?.length) {
    queryExtras.push(`Work arrangement: ${filters.locationTypes.join(", ")}.`);
  }
  query = appendQueryParts(query, queryExtras);

  const resumeText = profileTextForMatchReasons(profileInput);

  try {
    const search = await fetchHirebaseVectorJobs({
      query,
      ...filters,
      jobTitles: jobTitles.length ? jobTitles : filters.jobTitles,
      limit: filters.limit ?? 20,
      page: filters.page ?? 1,
    });

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

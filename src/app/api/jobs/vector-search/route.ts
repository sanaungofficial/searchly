import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured, fetchHirebaseVectorJobsByResume } from "@/lib/hirebase";
import { enrichVectorJobsWithMatchReasons } from "@/lib/hirebase-match-reasons";
import { ensureHirebaseArtifactForUser } from "@/lib/resume-artifact";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  if (!isHirebaseConfigured()) {
    return NextResponse.json({ error: "Hirebase is not configured on this environment." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let rawBody: Record<string, unknown> = {};
  try {
    rawBody = (await request.json()) as Record<string, unknown>;
  } catch {
    rawBody = {};
  }

  const filters = parseFilters(rawBody);

  const artifactState = await ensureHirebaseArtifactForUser(dbUser.id);
  if (!artifactState.artifactId) {
    return NextResponse.json(
      {
        error: artifactState.error ?? "Resume is not embedded for vector search. Re-upload your resume from Profile.",
        needsResume: !artifactState.resumeText,
        reEmbedded: artifactState.reEmbedded,
      },
      { status: artifactState.resumeText ? 422 : 404 }
    );
  }

  const resumeText = artifactState.resumeText ?? dbUser.profile?.resumeText ?? "";
  if (!resumeText.trim()) {
    return NextResponse.json({ error: "No resume text found." }, { status: 404 });
  }

  const targetRoles = dbUser.profile?.targetRoles ?? [];
  const jobTitles = filters.jobTitles?.length ? filters.jobTitles : targetRoles.slice(0, 3);

  try {
    const search = await fetchHirebaseVectorJobsByResume({
      artifactId: artifactState.artifactId,
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
      reEmbedded: artifactState.reEmbedded,
      filtersApplied: {
        ...filters,
        jobTitles: jobTitles.length ? jobTitles : null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Vector search failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

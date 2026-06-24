import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { isHirebaseConfigured, fetchHirebaseVectorJobsByResume } from "@/lib/hirebase";
import { enrichVectorJobsWithMatchReasons } from "@/lib/hirebase-match-reasons";
import { ensureHirebaseArtifactForUser } from "@/lib/resume-artifact";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { NextResponse } from "next/server";

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

  let body: VectorSearchFilters = {};
  try {
    body = (await request.json()) as VectorSearchFilters;
  } catch {
    body = {};
  }

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
  const jobTitles = body.jobTitles?.length ? body.jobTitles : targetRoles.slice(0, 3);

  try {
    const search = await fetchHirebaseVectorJobsByResume({
      artifactId: artifactState.artifactId,
      limit: body.limit ?? 20,
      page: body.page ?? 1,
      companyName: body.companyName,
      companySlug: body.companySlug,
      jobTitles: jobTitles.length ? jobTitles : undefined,
      locationTypes: body.locationTypes,
      accuracy: body.accuracy,
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
      filters: {
        jobTitles: jobTitles.length ? jobTitles : null,
        companyName: body.companyName ?? null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Vector search failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

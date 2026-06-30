import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  attachTailoredMeta,
  buildTailoredSourceFingerprint,
  extractTailoredMeta,
  filterDisplaySections,
  isTailoredResumeStale,
} from "@/lib/tailored-resume-sections";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const job = await prisma.job.findFirst({ where: { id: jobId, userId: dbUser.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const existing = await prisma.tailoredResume.findFirst({
    where: { jobId, userId: dbUser.id },
  });

  if (!existing) {
    return NextResponse.json({ sections: [], updatedAt: null, stale: false, hasTailored: false });
  }

  const stale = await isTailoredResumeStale(dbUser.id, existing.sections);

  const meta = extractTailoredMeta(existing.sections);
  const displaySections = filterDisplaySections(existing.sections);

  return NextResponse.json({
    sections: displaySections,
    updatedAt: existing.updatedAt.toISOString(),
    stale,
    hasTailored: displaySections.length > 0,
    resumeStyle: meta?.resumeStyle ?? null,
    injectedKeywords: meta?.injectedKeywords ?? [],
    changes: meta?.changes ?? [],
    previousScore: meta?.previousScore ?? null,
    newScore: meta?.newScore ?? null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const body = await req.json();
  const { sections, sourceAssetId, resumeStyle } = body as {
    sections: unknown;
    sourceAssetId?: string | null;
    resumeStyle?: import("@/lib/resume-style").ResumeStyleSettings | null;
  };

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const job = await prisma.job.findFirst({ where: { id: jobId, userId: dbUser.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const existing = await prisma.tailoredResume.findFirst({
    where: { jobId, userId: dbUser.id },
  });
  const existingMeta = extractTailoredMeta(existing?.sections);
  const fingerprint = await buildTailoredSourceFingerprint(
    dbUser.id,
    sourceAssetId ?? existingMeta?.sourceAssetId ?? null,
  );
  const withMeta = attachTailoredMeta(filterDisplaySections(sections), {
    sourceAssetId: sourceAssetId ?? existingMeta?.sourceAssetId ?? null,
    sourceFingerprint: fingerprint,
    injectedKeywords: existingMeta?.injectedKeywords,
    resumeStyle: resumeStyle !== undefined ? resumeStyle : existingMeta?.resumeStyle ?? null,
    changes: existingMeta?.changes,
    previousScore: existingMeta?.previousScore,
    newScore: existingMeta?.newScore,
  });

  const saved = await prisma.tailoredResume.upsert({
    where: { jobId },
    create: {
      jobId,
      userId: dbUser.id,
      sections: withMeta as unknown as Prisma.InputJsonValue,
    },
    update: { sections: withMeta as unknown as Prisma.InputJsonValue },
  });

  return NextResponse.json({
    success: true,
    updatedAt: saved.updatedAt.toISOString(),
  });
}
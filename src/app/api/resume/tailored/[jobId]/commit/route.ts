import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  attachTailoredMeta,
  buildTailoredSourceFingerprint,
  filterDisplaySections,
  mergeSkillsIntoMasterResume,
  plainTextToResumeSections,
} from "@/lib/tailored-resume-sections";

/** Save match-drawer tailored text → TailoredResume sections + merge skills to master profile. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const body = await req.json();
  const { tailoredText, sourceAssetId, injectedKeywords } = body as {
    tailoredText?: string;
    sourceAssetId?: string | null;
    injectedKeywords?: string[];
  };

  if (!tailoredText?.trim()) {
    return NextResponse.json({ error: "No tailored resume text provided" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const job = await prisma.job.findFirst({ where: { id: jobId, userId: dbUser.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const sections = plainTextToResumeSections(tailoredText);
  const fingerprint = await buildTailoredSourceFingerprint(dbUser.id, sourceAssetId ?? null);
  const withMeta = attachTailoredMeta(sections, {
    sourceAssetId: sourceAssetId ?? null,
    sourceFingerprint: fingerprint,
    injectedKeywords: injectedKeywords ?? [],
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

  const skillsAdded = await mergeSkillsIntoMasterResume(
    dbUser.id,
    injectedKeywords ?? [],
  );

  return NextResponse.json({
    sections: filterDisplaySections(withMeta),
    updatedAt: saved.updatedAt.toISOString(),
    skillsAdded,
  });
}

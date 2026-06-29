import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { resolveResumeTextForUser } from "@/lib/resolve-resume-text";

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const job = await prisma.job.findFirst({ where: { id: jobId, userId: dbUser.id } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const resumeText = await resolveResumeTextForUser(dbUser.id, dbUser.profile, null);
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  const template = await getPrompt("RESUME_TAILOR_REGEN");
  const promptContent = interpolate(template, {
    company: job.company || "",
    role: job.role || "",
    jobNotes: job.notes || "",
    resumeText,
  });

  const { text } = await kimchiGenerateText({
    tier: "create",
    prompt: promptContent,
    maxOutputTokens: 4096,
    userId: dbUser.id,
    tags: ["feature:resume-tailor-regen"],
  });

  let sections: unknown[] = [];
  try {
    sections = JSON.parse(text.trim());
  } catch {
    sections = [{ id: "1", title: "Resume", type: "text", content: resumeText }];
  }

  return NextResponse.json({ sections });
}

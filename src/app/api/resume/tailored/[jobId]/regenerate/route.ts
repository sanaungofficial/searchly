import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const [job, profile] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.profile.findFirst({ where: { user: { email: user.email! } } }),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const resumeText = profile?.resumeText || "";

  const template = await getPrompt("RESUME_TAILOR_REGEN");
  const promptContent = interpolate(template, {
    company: job.company || "",
    role: job.role || "",
    jobNotes: job.notes || "",
    resumeText: resumeText || "(no resume provided)",
  });

  const { text } = await kimchiGenerateText({
    tier: "create",
    prompt: promptContent,
    maxOutputTokens: 4096,
    userId: (await prisma.user.findUnique({ where: { email: user.email! }, select: { id: true } }))?.id,
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

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { resolveResumeTextForUser } from "@/lib/resolve-resume-text";

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
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

  const jobContext = [
    job.role ? `Role: ${job.role}` : "",
    job.company ? `Company: ${job.company}` : "",
    job.notes ? `Description: ${job.notes}` : "",
  ].filter(Boolean).join("\n");

  const resumeText = await resolveResumeTextForUser(dbUser.id, dbUser.profile, null);
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  if (!jobContext.trim()) {
    return NextResponse.json({ score: 0, matched: [], missing: [], total: 0 });
  }

  const template = await getPrompt("RESUME_MATCH");
  const promptContent = interpolate(template, { jobContext });

  const { text } = await kimchiGenerateText({
    tier: "analyze",
    prompt: promptContent,
    maxOutputTokens: 512,
    userId: dbUser.id,
    tags: ["feature:resume-match"],
  });

  let keywords: string[] = [];
  try {
    keywords = JSON.parse(text.trim());
    if (!Array.isArray(keywords)) keywords = [];
  } catch {
    keywords = [];
  }

  const resumeLower = resumeText.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of keywords) {
    if (resumeLower.includes(kw.toLowerCase())) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const total = keywords.length;
  const score = total > 0 ? Math.round((matched.length / total) * 100) : 0;

  return NextResponse.json({ score, matched, missing, total });
}

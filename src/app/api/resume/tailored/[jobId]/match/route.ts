import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

let _a: Anthropic | null = null;
function getAnthropic() {
  if (!_a) _a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _a;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const [job, profile] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.profile.findFirst({ where: { user: { email: user.email! } } }),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const jobContext = [
    job.role ? `Role: ${job.role}` : "",
    job.company ? `Company: ${job.company}` : "",
    job.notes ? `Description: ${job.notes}` : "",
  ].filter(Boolean).join("\n");

  const resumeText = profile?.resumeText || "";

  if (!jobContext.trim()) {
    return NextResponse.json({ score: 0, matched: [], missing: [], total: 0 });
  }

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `Extract the 12-15 most important skills, technologies, and qualifications from this job description. Focus on specific, concrete terms (not vague phrases like "communication skills" or "team player").

JOB:
${jobContext}

Return ONLY a JSON array of strings, e.g. ["SQL", "product roadmap", "stakeholder management", "Python"]
Return ONLY the JSON array, no other text.`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
  let keywords: string[] = [];
  try {
    keywords = JSON.parse(raw);
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

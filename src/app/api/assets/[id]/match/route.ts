import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt, interpolate } from "@/lib/prompts";
import { normalizeParsedResumeData, parsedResumeToText } from "@/lib/resume-parse";
import { fallbackJobMatch } from "@/lib/resume-match";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, include: { subscription: true } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const asset = await prisma.userAsset.findFirst({ where: { id, userId: dbUser.id, type: "RESUME" } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return NextResponse.json({ error: "Job description required" }, { status: 400 });

  const parsed = normalizeParsedResumeData(asset.parsedData);
  const resumeText = asset.resumeText?.trim() || (parsed ? parsedResumeToText(parsed) : "");
  if (!resumeText.trim()) return NextResponse.json({ error: "Resume is empty" }, { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(fallbackJobMatch(description, resumeText));
  }

  const quotaError = await requireAiQuota(dbUser);
  if (quotaError) return quotaError;

  const template = await getPrompt("JOB_MATCH");
  const prompt = interpolate(template, {
    jobTitle: typeof body.jobTitle === "string" ? body.jobTitle : "Target role",
    company: typeof body.company === "string" ? body.company : "Target company",
    description: description.slice(0, 4000),
    resumeSlice: resumeText.slice(0, 4000),
  });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  logAiUsage(dbUser.id, "FIT_ANALYSIS", "claude-haiku-4-5-20251001", message.usage.input_tokens, message.usage.output_tokens);

  const content = message.content[0];
  if (content.type !== "text") return NextResponse.json({ error: "Unexpected response" }, { status: 500 });

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const result = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(result.keywords)) result.keywords = [];
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(fallbackJobMatch(description, resumeText));
  }
}

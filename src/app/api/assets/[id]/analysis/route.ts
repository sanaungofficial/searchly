import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt, interpolate } from "@/lib/prompts";
import { normalizeParsedResumeData, parseJsonFromModel } from "@/lib/resume-parse";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const ANALYSIS_MODEL = "claude-haiku-4-5-20251001";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const asset = await prisma.userAsset.findFirst({ where: { id, userId: dbUser.id, type: "RESUME" } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!force && asset.analysisData && asset.analysisUpdatedAt) {
    return NextResponse.json({
      ...(asset.analysisData as Record<string, unknown>),
      _cachedAt: asset.analysisUpdatedAt.toISOString(),
    });
  }

  const resumeSlice = asset.resumeText || JSON.stringify(normalizeParsedResumeData(asset.parsedData) ?? {});
  const template = await getPrompt("RESUME_ASSET_ANALYSIS");
  const prompt = interpolate(template, { resumeSlice: resumeSlice.slice(0, 8000) });

  const message = await getAnthropic().messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2200,
    messages: [{ role: "user", content: prompt }],
  });

  logAiUsage(dbUser.id, "RESUME_ASSET_ANALYSIS", ANALYSIS_MODEL, message.usage.input_tokens, message.usage.output_tokens);

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const parsed = parseJsonFromModel(text);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Failed to parse analysis" }, { status: 500 });
  }

  const now = new Date();
  await prisma.userAsset.update({
    where: { id },
    data: { analysisData: parsed, analysisUpdatedAt: now },
  });

  return NextResponse.json({ ...(parsed as Record<string, unknown>), _cachedAt: now.toISOString() });
}

import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { normalizeParsedResumeData, parseJsonFromModel } from "@/lib/resume-parse";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isKimchiAiConfigured()) {
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

  const { text, usage, modelId } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 2200,
    userId: dbUser.id,
    tags: ["feature:resume-asset-analysis"],
  });

  logAiUsage(dbUser.id, "FIT_ANALYSIS", modelId, usage.inputTokens, usage.outputTokens);

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

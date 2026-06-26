import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { loadJobDescriptionForUser } from "@/lib/job-description-server";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { normalizeParsedResumeData, parsedResumeToText } from "@/lib/resume-parse";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const auth = await getAuthedUserForAi(req);
  if ("error" in auth) return auth.error;
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser, "MATCH");
  if (quotaError) return quotaError;

  const body = await req.json();
  const { jobTitle, company, description, jobId, assetId } = body as {
    jobTitle?: string;
    company?: string;
    description?: string;
    jobId?: string;
    assetId?: string;
  };

  let resumeText = dbUser.profile?.resumeText?.trim() ?? "";
  if (assetId?.trim()) {
    const asset = await prisma.userAsset.findFirst({
      where: { id: assetId.trim(), userId: dbUser.id, type: "RESUME" },
    });
    if (!asset) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const parsed = normalizeParsedResumeData(asset.parsedData);
    resumeText = asset.resumeText?.trim() || (parsed ? parsedResumeToText(parsed) : "");
  }
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  let finalDescription = description?.trim() ?? "";
  if (!finalDescription && jobId) {
    finalDescription = (await loadJobDescriptionForUser(jobId, dbUser.id)) ?? "";
  }

  if (!finalDescription) {
    return NextResponse.json({ error: "No job description provided" }, { status: 400 });
  }

  const template = await getPrompt("JOB_MATCH");
  const prompt = interpolate(template, {
    jobTitle: jobTitle || "Unknown",
    company: company || "Unknown",
    description: finalDescription.slice(0, 4000),
    resumeSlice: resumeText.slice(0, 4000),
  });

  const { text } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 1024,
    userId: dbUser.id,
    tags: ["feature:job-match"],
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

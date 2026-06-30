import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-usage";
import { loadJobDescriptionForUser } from "@/lib/job-description-server";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { computeResumeJobMatch } from "@/lib/resume-job-comparison";
import { resolveResumeTextForUser } from "@/lib/resolve-resume-text";
import { NextRequest, NextResponse } from "next/server";

type FallbackReason = "no_ai" | "parse_error" | "ai_error";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { jobTitle, company, description, jobId, assetId } = body as {
    jobTitle?: string;
    company?: string;
    description?: string;
    jobId?: string;
    assetId?: string;
  };

  const auth = await getAuthedUserForAi(req);
  if ("error" in auth) return auth.error;
  const { dbUser } = auth;

  const resumeText = await resolveResumeTextForUser(dbUser.id, dbUser.profile, assetId);
  if (!resumeText) {
    if (assetId?.trim()) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  let finalDescription = description?.trim() ?? "";
  if (!finalDescription && jobId) {
    finalDescription = (await loadJobDescriptionForUser(jobId, dbUser.id)) ?? "";
  }

  if (!finalDescription) {
    return NextResponse.json({ error: "No job description provided" }, { status: 400 });
  }

  const resolvedTitle = jobTitle || "Unknown role";
  const resolvedCompany = company || "Unknown company";

  const profileFallback = (reason: FallbackReason) =>
    NextResponse.json({
      ...computeResumeJobMatch({
        jobTitle: resolvedTitle,
        company: resolvedCompany,
        description: finalDescription,
        resumeText,
      }),
      _fallback: true,
      _fallbackReason: reason,
    });

  if (!isKimchiAiConfigured()) {
    return profileFallback("no_ai");
  }

  const quotaError = await requireAiQuota(dbUser, "MATCH");
  if (quotaError) return quotaError;

  const template = await getPrompt("JOB_MATCH");
  const prompt = interpolate(template, {
    jobTitle: resolvedTitle,
    company: resolvedCompany,
    description: finalDescription.slice(0, 4000),
    resumeSlice: resumeText.slice(0, 4000),
  });

  let text: string;
  let usage: { inputTokens: number; outputTokens: number };
  let modelId: string;
  try {
    const result = await kimchiGenerateText({
      tier: "analyze",
      prompt,
      maxOutputTokens: 1024,
      userId: dbUser.id,
      tags: ["feature:job-match"],
    });
    text = result.text;
    usage = result.usage;
    modelId = result.modelId;
  } catch {
    return profileFallback("ai_error");
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(result.keywords)) result.keywords = [];
    logAiUsage(dbUser.id, "FIT_ANALYSIS", modelId, usage.inputTokens, usage.outputTokens);
    return NextResponse.json(result);
  } catch {
    return profileFallback("parse_error");
  }
}

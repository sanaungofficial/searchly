import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { loadJobDescriptionForUser } from "@/lib/job-description-server";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { computeResumeJobMatch } from "@/lib/resume-job-comparison";
import { resolveResumeTextForUser } from "@/lib/resolve-resume-text";
import { NextRequest, NextResponse } from "next/server";

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

  const profileMatch = () =>
    computeResumeJobMatch({
      jobTitle: resolvedTitle,
      company: resolvedCompany,
      description: finalDescription,
      resumeText,
    });

  if (!isKimchiAiConfigured()) {
    return NextResponse.json(profileMatch());
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
    if (!Array.isArray(result.keywords)) result.keywords = [];
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(profileMatch());
  }
}

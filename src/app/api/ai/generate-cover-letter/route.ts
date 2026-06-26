import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { loadJobDescriptionForUser } from "@/lib/job-description-server";
import { isKimchiAiConfigured, kimchiStreamText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const auth = await getAuthedUserForAi();
  if ("error" in auth) return auth.error;
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser, "COVER_LETTER");
  if (quotaError) return quotaError;

  const resumeText = dbUser.profile?.resumeText;
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  const body = await req.json();
  const { jobTitle, company, description, jobId } = body as {
    jobTitle?: string;
    company?: string;
    description?: string;
    jobId?: string;
  };

  let finalDescription = description?.trim() ?? "";
  if (!finalDescription && jobId) {
    finalDescription = (await loadJobDescriptionForUser(jobId, dbUser.id)) ?? "";
  }

  if (!finalDescription) {
    return NextResponse.json({ error: "No job description provided" }, { status: 400 });
  }

  const candidateName = dbUser?.name || "the candidate";

  const template = await getPrompt("COVER_LETTER_FULL");
  const prompt = interpolate(template, {
    jobTitle: jobTitle || "Unknown",
    company: company || "Unknown",
    description: finalDescription.slice(0, 3000),
    resumeSlice: resumeText.slice(0, 3000),
    candidateName,
  });

  return kimchiStreamText({
    tier: "create",
    messages: [{ role: "user", content: prompt }],
    maxOutputTokens: 800,
    userId: dbUser.id,
    tags: ["feature:cover-letter"],
  });
}

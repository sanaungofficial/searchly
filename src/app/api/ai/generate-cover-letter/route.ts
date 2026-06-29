import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { loadJobDescriptionForUser } from "@/lib/job-description-server";
import { isKimchiAiConfigured, kimchiStreamText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { resolveResumeTextForUser } from "@/lib/resolve-resume-text";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const auth = await getAuthedUserForAi(req);
  if ("error" in auth) return auth.error;
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser, "COVER_LETTER");
  if (quotaError) return quotaError;

  const body = await req.json();
  const { jobTitle, company, description, jobId, assetId, context } = body as {
    jobTitle?: string;
    company?: string;
    description?: string;
    jobId?: string;
    assetId?: string;
    context?: {
      motivation?: string;
      achievements?: string;
      tone?: string;
      notes?: string;
    };
  };

  const resumeText = await resolveResumeTextForUser(dbUser.id, dbUser.profile, assetId);
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

  const candidateName = dbUser?.name || "the candidate";

  const motivation = context?.motivation?.trim() || "Not specified — infer from resume and job description.";
  const achievements = context?.achievements?.trim() || "Not specified — pick the 2 strongest relevant wins from the resume.";
  const tone =
    context?.tone === "formal" ? "formal" : "conversational";
  const notes = context?.notes?.trim() || "None — use standard professional language.";

  const template = await getPrompt("COVER_LETTER_FULL");
  const prompt = interpolate(template, {
    jobTitle: jobTitle || "Unknown",
    company: company || "Unknown",
    description: finalDescription.slice(0, 3000),
    resumeSlice: resumeText.slice(0, 3000),
    candidateName,
    motivation,
    achievements,
    tone,
    notes,
  });

  return await kimchiStreamText({
    tier: "create",
    messages: [{ role: "user", content: prompt }],
    maxOutputTokens: 900,
    userId: dbUser.id,
    tags: ["feature:cover-letter"],
  });
}

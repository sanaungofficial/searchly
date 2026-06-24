import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { loadJobDescriptionForUser } from "@/lib/job-description-server";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

let _a: Anthropic | null = null;
function getAnthropic() {
  if (!_a) _a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _a;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const auth = await getAuthedUserForAi();
  if ("error" in auth) return auth.error;
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser, "TAILOR");
  if (quotaError) return quotaError;

  const resumeText = dbUser.profile?.resumeText;
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    jobTitle,
    company,
    description,
    jobId,
    selectedSections,
    missingKeywords,
    workEditMode,
  } = body as {
    jobTitle?: string;
    company?: string;
    description?: string;
    jobId?: string;
    selectedSections?: string[];
    missingKeywords?: string[];
    workEditMode?: "quick" | "full";
  };

  let finalDescription = description?.trim() ?? "";
  if (!finalDescription && jobId) {
    finalDescription = (await loadJobDescriptionForUser(jobId, dbUser.id)) ?? "";
  }

  if (!finalDescription) {
    return NextResponse.json({ error: "No job description provided" }, { status: 400 });
  }

  const sections = selectedSections ?? ["summary", "skills", "work_experience"];
  const sectionsLabel = sections
    .map((s) => {
      if (s === "work_experience") {
        return workEditMode === "quick"
          ? "Work Experience (first 2 positions only)"
          : "Work Experience (all positions)";
      }
      return s.replace(/_/g, " ");
    })
    .join(", ");

  const keywords = missingKeywords ?? [];
  const keywordsLabel =
    keywords.length > 0 ? keywords.join(", ") : "none — focus on rephrasing only";

  const prompt = `You are an expert resume writer tailoring a resume for a specific job application.

JOB: ${jobTitle ?? "Unknown"} at ${company ?? "Unknown"}

JOB DESCRIPTION:
${finalDescription.slice(0, 3000)}

CANDIDATE'S ORIGINAL RESUME:
${resumeText.slice(0, 4000)}

INSTRUCTIONS:
- Sections to enhance: ${sectionsLabel}
- Missing keywords to naturally integrate: ${keywordsLabel}
- Do NOT fabricate experience, credentials, or metrics not in the original resume
- Keep all existing facts intact — just improve framing and language
- Weave in keywords naturally; avoid keyword stuffing
- Maintain professional tone throughout

Return ONLY a valid JSON object with no markdown, no explanation, no code fences:
{
  "tailoredText": "the full tailored resume as plain text, preserving the original structure with only the selected sections rewritten",
  "changes": ["Specific description of change 1", "Specific description of change 2"],
  "newScore": 8.5,
  "tweaks": [
    { "id": "action_verbs", "label": "Use stronger action verbs in your most recent role" }
  ],
  "injectedKeywords": ["keyword1", "keyword2"]
}

Rules:
- changes: 2–4 bullet points, each starting with a past-tense verb (e.g. "Updated summary to emphasize...", "Added 3 missing skill keywords...", "Strengthened 2 experience bullets...")
- newScore: float 0–10, starting from original and adjusted upward proportional to improvements made
- tweaks: 2–3 additional optional improvements the candidate could still make (keep labels concise, under 55 chars)
- injectedKeywords: list only keywords from the provided missing list that were actually added`;

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

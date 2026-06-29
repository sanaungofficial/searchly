import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { loadJobDescriptionForUser } from "@/lib/job-description-server";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { parseJsonFromModel } from "@/lib/resume-parse";
import { resolveResumeTextForUser } from "@/lib/resolve-resume-text";
import { NextRequest, NextResponse } from "next/server";

const TAILOR_MAX_TOKENS = 8192;

type TailorResult = {
  tailoredText: string;
  changes: string[];
  newScore: number;
  tweaks: { id: string; label: string }[];
  injectedKeywords: string[];
};

function normalizeTailorResult(raw: unknown): TailorResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const tailoredText = typeof obj.tailoredText === "string" ? obj.tailoredText.trim() : "";
  if (!tailoredText) return null;

  const changes = Array.isArray(obj.changes)
    ? obj.changes.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];
  const newScore =
    typeof obj.newScore === "number" && Number.isFinite(obj.newScore)
      ? obj.newScore
      : typeof obj.newScore === "string"
        ? Number.parseFloat(obj.newScore)
        : 0;
  const tweaks = Array.isArray(obj.tweaks)
    ? obj.tweaks
        .map((t, i) => {
          if (!t || typeof t !== "object") return null;
          const row = t as Record<string, unknown>;
          const label = typeof row.label === "string" ? row.label.trim() : "";
          if (!label) return null;
          const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `tweak_${i}`;
          return { id, label };
        })
        .filter((t): t is { id: string; label: string } => t !== null)
    : [];
  const injectedKeywords = Array.isArray(obj.injectedKeywords)
    ? obj.injectedKeywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    : [];

  return {
    tailoredText,
    changes,
    newScore: Number.isFinite(newScore) ? newScore : 0,
    tweaks,
    injectedKeywords,
  };
}

function parseTailorResponse(text: string, stopReason: string | null): TailorResult | { error: string } {
  const parsed = parseJsonFromModel(text);
  const result = normalizeTailorResult(parsed);
  if (result) return result;

  if (stopReason === "max_tokens") {
    return {
      error:
        "Resume generation was cut off before finishing. Try selecting fewer sections or use Quick edit mode, then try again.",
    };
  }

  console.error("[tailor-resume] parse failed", {
    stopReason,
    preview: text.slice(0, 400),
  });
  return { error: "Failed to parse response. Please try again." };
}

export async function POST(req: NextRequest) {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const auth = await getAuthedUserForAi(req);
  if ("error" in auth) return auth.error;
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser, "TAILOR");
  if (quotaError) return quotaError;

  const body = await req.json();
  const {
    jobTitle,
    company,
    description,
    jobId,
    assetId,
    selectedSections,
    missingKeywords,
    workEditMode,
    applyTweak,
    baseTailoredText,
  } = body as {
    jobTitle?: string;
    company?: string;
    description?: string;
    jobId?: string;
    assetId?: string;
    selectedSections?: string[];
    missingKeywords?: string[];
    workEditMode?: "quick" | "full";
    applyTweak?: string;
    baseTailoredText?: string;
  };

  const resumeText = await resolveResumeTextForUser(dbUser.id, dbUser.profile, assetId);
  if (!resumeText) {
    if (assetId?.trim()) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  if (applyTweak?.trim() && baseTailoredText?.trim()) {
    const tweakPrompt = `You are an expert resume writer. Apply ONE optional improvement to this tailored resume.

IMPROVEMENT TO APPLY: ${applyTweak.trim()}

CURRENT TAILORED RESUME:
${baseTailoredText.slice(0, 5000)}

Rules:
- Apply only the requested improvement — do not rewrite unrelated sections
- Do NOT fabricate experience, credentials, or metrics
- Keep the same overall structure

Return ONLY valid JSON:
{
  "tailoredText": "full updated resume text",
  "changes": ["What changed in one sentence"],
  "newScore": 8.5,
  "tweaks": [{ "id": "slug", "label": "Another optional improvement under 55 chars" }],
  "injectedKeywords": []
}`;

    try {
      const { text } = await kimchiGenerateText({
        tier: "create",
        prompt: tweakPrompt,
        maxOutputTokens: TAILOR_MAX_TOKENS,
        userId: dbUser.id,
        tags: ["feature:tailor-resume-tweak"],
      });
      const parsed = parseTailorResponse(text, null);
      if ("error" in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 500 });
      }
      return NextResponse.json(parsed);
    } catch (err) {
      console.error("[tailor-resume] tweak API error", err);
      const message = err instanceof Error ? err.message : "AI request failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

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

  try {
    const { text } = await kimchiGenerateText({
      tier: "create",
      prompt,
      maxOutputTokens: TAILOR_MAX_TOKENS,
      userId: dbUser.id,
      tags: ["feature:tailor-resume"],
    });

    const parsed = parseTailorResponse(text, null);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 500 });
    }
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[tailor-resume] API error", err);
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

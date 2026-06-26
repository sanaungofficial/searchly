import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const auth = await getAuthedUserForAi();
  if ("error" in auth) return auth.error;
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser, "TAILOR");
  if (quotaError) return quotaError;

  const body = await req.json();
  const tailoredText = typeof body.tailoredText === "string" ? body.tailoredText.trim() : "";
  const tweakLabel = typeof body.tweakLabel === "string" ? body.tweakLabel.trim() : "";
  const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle : "";
  const company = typeof body.company === "string" ? body.company : "";

  if (!tailoredText || !tweakLabel) {
    return NextResponse.json({ error: "Missing resume text or tweak" }, { status: 400 });
  }

  const prompt = `You are an expert resume writer. Apply ONE optional improvement to a tailored resume.

Job: ${jobTitle || "Unknown"} at ${company || "Unknown"}
Improvement to apply: ${tweakLabel}

Current tailored resume:
${tailoredText.slice(0, 6000)}

Return ONLY valid JSON:
{
  "tailoredText": "the full updated resume text with the tweak applied",
  "changeSummary": "one sentence describing what changed"
}

Rules:
- Apply only the requested tweak; keep all other content intact
- Do not fabricate experience or credentials
- Preserve overall structure and formatting`;

  try {
    const { text } = await kimchiGenerateText({
      tier: "create",
      prompt,
      maxOutputTokens: 4096,
      userId: dbUser.id,
      tags: ["feature:apply-resume-tweak"],
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const result = JSON.parse(jsonMatch[0]) as { tailoredText?: string; changeSummary?: string };
    if (!result.tailoredText?.trim()) {
      return NextResponse.json({ error: "Could not apply tweak" }, { status: 500 });
    }

    return NextResponse.json({
      tailoredText: result.tailoredText,
      changeSummary: result.changeSummary ?? `Applied: ${tweakLabel}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to apply tweak" }, { status: 500 });
  }
}

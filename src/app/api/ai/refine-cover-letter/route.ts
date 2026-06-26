import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { isKimchiAiConfigured, kimchiStreamText } from "@/lib/llm";
import { KIMCHI_VOICE } from "@/lib/prompts";
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
  const { currentLetter, prompt, jobTitle, company, description } = body as {
    currentLetter: string;
    prompt: string;
    jobTitle?: string;
    company?: string;
    description?: string;
  };

  if (!currentLetter || !prompt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const systemPrompt = `${KIMCHI_VOICE}

You will be given a cover letter and a specific instruction to improve it. Rewrite the cover letter according to the instruction. Return only the updated cover letter text — no explanation, no preamble, no markdown. Keep the same general structure and length unless the instruction says otherwise. The letter should start with the salutation (e.g. "Dear Hiring Manager,").`;

  const userMessage = [
    `Job: ${jobTitle || "Unknown"} at ${company || "Unknown"}`,
    description ? `Job description excerpt:\n${description.slice(0, 1500)}` : "",
    "",
    "Current cover letter:",
    currentLetter,
    "",
    `Instruction: ${prompt}`,
  ].filter(Boolean).join("\n");

  return await kimchiStreamText({
    tier: "create",
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxOutputTokens: 900,
    userId: dbUser.id,
    tags: ["feature:cover-letter-refine"],
  });
}

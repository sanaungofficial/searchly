import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { KIMCHI_VOICE } from "@/lib/prompts";
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

  const anthropicStream = getAnthropic().messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 900,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of anthropicStream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
    cancel() {
      anthropicStream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { getPrompt, interpolate } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const auth = await getAuthedUserForAi();
  if ("error" in auth) return auth.error;
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser);
  if (quotaError) return quotaError;

  const body = await request.json();
  const { tool, company, role, notes, jobId } = body as {
    tool: "resume" | "cover" | "fit";
    company: string;
    role: string;
    notes?: string;
    jobId?: string;
  };

  if (!tool || !company || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  let jobNotes = notes || "";
  if (jobId && !notes) {
    const job = await prisma.job.findFirst({ where: { id: jobId, userId: dbUser.id } });
    jobNotes = job?.notes || "";
  }

  const userName = dbUser.name || "the candidate";
  const resumeText = dbUser.profile?.resumeText || "";
  const profileContext = [
    resumeText ? `RESUME:\n${resumeText}` : "",
    dbUser.profile?.linkedinUrl ? `LinkedIn: ${dbUser.profile.linkedinUrl}` : "",
    dbUser.profile?.headline ? `Headline: ${dbUser.profile.headline}` : "",
    dbUser.profile?.targetRoles?.length ? `Target roles: ${dbUser.profile.targetRoles.join(", ")}` : "",
  ].filter(Boolean).join("\n\n");

  let prompt = "";

  if (tool === "resume") {
    const template = await getPrompt("RESUME_BULLETS");
    const resumeInstruction = resumeText
      ? "Using the candidate's actual resume above, generate"
      : "Generate";
    const jobNotesBlock = jobNotes ? `\nJob notes/description: ${jobNotes}` : "";
    prompt = interpolate(template, { userName, company, role, profileContext, jobNotes: jobNotesBlock, resumeInstruction });
  } else if (tool === "cover") {
    const template = await getPrompt("COVER_LETTER_QUICK");
    const resumeInstruction = resumeText
      ? "Drawing from the candidate's actual resume above, write"
      : "Write";
    const jobNotesBlock = jobNotes ? `Job notes/description: ${jobNotes}` : "";
    prompt = interpolate(template, { userName, company, role, profileContext, jobNotes: jobNotesBlock, resumeInstruction });
  } else if (tool === "fit") {
    const template = await getPrompt("FIT_ANALYSIS");
    const resumeInstruction = resumeText
      ? "Based on the candidate's actual resume above, analyze"
      : "Analyze";
    const jobNotesBlock = jobNotes ? `Job notes/description: ${jobNotes}` : "";
    prompt = interpolate(template, { userName, company, role, profileContext, jobNotes: jobNotesBlock, resumeInstruction });
  }

  const MODEL = "claude-haiku-4-5-20251001";
  const message = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const aiFeature = tool === "cover" ? "COVER_LETTER" : tool === "fit" ? "FIT_ANALYSIS" : "RESUME_BULLETS";
  logAiUsage(dbUser.id, aiFeature as import("@prisma/client").AiFeature, MODEL, message.usage.input_tokens, message.usage.output_tokens);

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  if (tool === "resume") {
    try {
      const parsed = JSON.parse(content.text);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }
  }

  return NextResponse.json({ text: content.text });
}

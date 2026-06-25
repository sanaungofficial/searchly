import { getActingUser, quotaUserFor } from "@/lib/acting-user";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { anthropicErrorResponse } from "@/lib/anthropic-errors";
import { fillIntakePrompt } from "@/lib/career-strategy-context";
import { parseIntakeJson } from "@/lib/career-strategy";
import { ensureProfileRow } from "@/lib/profile-write";
import { prisma } from "@/lib/prisma";
import { getPrompt } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const PARSE_MODEL = "claude-haiku-4-5-20251001";

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const acting = await getActingUser(request);
    const { dbUser } = acting;
    if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const notes = (body.notes as string)?.trim();
    if (!notes) return NextResponse.json({ error: "Notes are required" }, { status: 400 });

    const quotaUser = quotaUserFor(acting);
    if (!quotaUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const quotaError = await requireAiQuota(quotaUser, "STRATEGY");
    if (quotaError) return quotaError;

    await ensureProfileRow(dbUser.id);

    const user = await prisma.user.findUnique({
      where: { id: dbUser.id },
      include: { profile: true },
    });
    if (!user?.profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const template = await getPrompt("STRATEGY_INTAKE_PARSE");
    const prompt = fillIntakePrompt(template, notes, {
      user,
      profile: user.profile,
      trackedCompanies: [],
      intakeNotes: notes,
    });

    const message = await getAnthropic().messages.create({
      model: PARSE_MODEL,
      max_tokens: 3500,
      messages: [{ role: "user", content: prompt }],
    });

    logAiUsage({
      userId: dbUser.id,
      feature: "strategy_intake",
      model: PARSE_MODEL,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }).catch(() => {});

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
    }

    try {
      const parsed = parseIntakeJson(content.text);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "Failed to parse intake response" }, { status: 500 });
    }
  } catch (err) {
    console.error("[strategy-intake POST]", err);
    return anthropicErrorResponse(err);
  }
}

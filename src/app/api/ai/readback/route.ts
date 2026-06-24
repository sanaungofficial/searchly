import { prisma } from "@/lib/prisma";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { getPrompt, interpolate } from "@/lib/prompts";
import { getActingUser } from "@/lib/acting-user";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function GET(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const { dbUser: actingUser } = await getActingUser(request);
  if (!actingUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: actingUser.id },
    include: { profile: true, subscription: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!force && dbUser.profile) {
    const cached = dbUser.profile.readbackData as Record<string, unknown> | null;
    const cachedAt = dbUser.profile.readbackUpdatedAt;
    if (cached && cachedAt) {
      return NextResponse.json({ ...cached, _cachedAt: cachedAt.toISOString() });
    }
  }

  const quotaError = await requireAiQuota(dbUser, "READBACK");
  if (quotaError) return quotaError;

  const resumeText = dbUser?.profile?.resumeText;
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  const template = await getPrompt("READBACK");
  const prompt = interpolate(template, { resumeSlice: resumeText.slice(0, 6000) });

  const READBACK_MODEL = "claude-haiku-4-5-20251001";
  const message = await getAnthropic().messages.create({
    model: READBACK_MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  logAiUsage({
    userId: dbUser?.id ?? user.id,
    feature: "readback",
    model: READBACK_MODEL,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  }).catch(() => {});

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);

    if (dbUser?.profile) {
      const now = new Date();
      await prisma.profile.update({
        where: { id: dbUser.profile.id },
        data: { readbackData: parsed, readbackUpdatedAt: now },
      }).catch(() => {});
      return NextResponse.json({ ...parsed, _cachedAt: now.toISOString() });
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

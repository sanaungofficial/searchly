import { prisma } from "@/lib/prisma";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { getPrompt, interpolate } from "@/lib/prompts";
import { getActingUser } from "@/lib/acting-user";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _a: Anthropic | null = null;
function getAnthropic() {
  if (!_a) _a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _a;
}

const SUGGESTIONS_MODEL = "claude-haiku-4-5-20251001";

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

  const profile = dbUser?.profile;
  const resumeText = profile?.resumeText;
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  if (!force && profile?.profileSuggestionsData) {
    const cachedAt = profile.profileSuggestionsUpdatedAt;
    if (cachedAt) {
      return NextResponse.json({
        suggestions: profile.profileSuggestionsData,
        _cachedAt: cachedAt.toISOString(),
      });
    }
  }

  const quotaError = await requireAiQuota(dbUser!, "SCOUT");
  if (quotaError) return quotaError;

  const parsedData = profile?.parsedData as Record<string, unknown> | null;
  const skills = Array.isArray(parsedData?.skills)
    ? (parsedData.skills as string[]).join(", ")
    : "";
  const linkedinUrl = profile?.linkedinUrl || "";
  const headline = profile?.headline || "";
  const targetRoles = Array.isArray(profile?.targetRoles)
    ? (profile.targetRoles as string[]).join(", ")
    : "";

  const template = await getPrompt("PROFILE_SUGGESTIONS");
  const prompt = interpolate(template, {
    resumeSlice: resumeText.slice(0, 5000),
    linkedinUrl: linkedinUrl || "Not provided",
    headline: headline || "Not provided",
    skills: skills || "None listed",
    targetRoles: targetRoles || "Not specified",
  });

  const message = await getAnthropic().messages.create({
    model: SUGGESTIONS_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  logAiUsage({
    userId: dbUser!.id,
    feature: "profile_suggestions",
    model: SUGGESTIONS_MODEL,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  }).catch(() => {});

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");
    const suggestions = JSON.parse(jsonMatch[0]);

    if (profile) {
      const now = new Date();
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          profileSuggestionsData: suggestions,
          profileSuggestionsUpdatedAt: now,
        },
      });
    }

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

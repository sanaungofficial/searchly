import { prisma } from "@/lib/prisma";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { getActingUser } from "@/lib/acting-user";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!isKimchiAiConfigured()) {
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

  const { text, usage, modelId } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 1024,
    userId: dbUser!.id,
    tags: ["feature:profile-suggestions"],
  });

  logAiUsage({
    userId: dbUser!.id,
    feature: "profile_suggestions",
    model: modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  }).catch(() => {});

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");
    const suggestions = JSON.parse(jsonMatch[0]);

    if (profile) {
      try {
        const now = new Date();
        await prisma.profile.update({
          where: { id: profile.id },
          data: {
            profileSuggestionsData: suggestions,
            profileSuggestionsUpdatedAt: now,
          },
        });
      } catch (err) {
        console.warn("[profile-suggestions] cache persist failed:", err);
      }
    }

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

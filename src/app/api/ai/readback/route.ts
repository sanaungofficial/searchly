import { formatReadbackForDisplay, readbackFirstName, type ReadbackPayload } from "@/lib/readback-display";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { getActingUser } from "@/lib/acting-user";
import { prisma } from "@/lib/prisma";
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
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!force && dbUser.profile) {
    const cached = dbUser.profile.readbackData as ReadbackPayload | null;
    const cachedAt = dbUser.profile.readbackUpdatedAt;
    if (cached && cachedAt) {
      const formatted = formatReadbackForDisplay(cached, dbUser.name);
      return NextResponse.json({ ...formatted, _cachedAt: cachedAt.toISOString() });
    }
  }

  let resumeText = dbUser.profile?.resumeText?.trim() ?? "";
  if (!resumeText) {
    const primary = await prisma.userAsset.findFirst({
      where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
      select: { resumeText: true },
      orderBy: { createdAt: "desc" },
    });
    resumeText = primary?.resumeText?.trim() ?? "";
    if (resumeText && dbUser.profile) {
      await prisma.profile
        .update({ where: { id: dbUser.profile.id }, data: { resumeText } })
        .catch(() => {});
    }
  }

  if (!resumeText) {
    return NextResponse.json(
      { error: "No resume found", retryable: true },
      { status: 404 },
    );
  }

  const quotaError = await requireAiQuota(dbUser, "READBACK");
  if (quotaError) return quotaError;

  const template = await getPrompt("READBACK");
  const candidateName = readbackFirstName(dbUser.name);
  const prompt = interpolate(template, {
    resumeSlice: resumeText.slice(0, 6000),
    candidateName,
  });

  const { text, usage, modelId } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 800,
    userId: dbUser.id,
    tags: ["feature:readback"],
  });

  logAiUsage({
    userId: dbUser.id,
    feature: "READBACK",
    model: modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  }).catch(() => {});

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]) as ReadbackPayload;
    const formatted = formatReadbackForDisplay(parsed, dbUser.name);

    if (dbUser?.profile) {
      const now = new Date();
      await prisma.profile.update({
        where: { id: dbUser.profile.id },
        data: { readbackData: formatted, readbackUpdatedAt: now },
      }).catch(() => {});
      return NextResponse.json({ ...formatted, _cachedAt: now.toISOString() });
    }

    return NextResponse.json(formatted);
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

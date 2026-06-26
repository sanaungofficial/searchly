import { getActingUser, quotaUserFor, canAccessAdminClientTools } from "@/lib/acting-user";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { anthropicErrorResponse } from "@/lib/anthropic-errors";
import { fillIntakePrompt } from "@/lib/career-strategy-context";
import { parseIntakeJson } from "@/lib/career-strategy";
import { ensureProfileRow } from "@/lib/profile-write";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { getPrompt } from "@/lib/prompts";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    if (!isKimchiAiConfigured()) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const acting = await getActingUser(request);
    const { dbUser } = acting;
    if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canAccessAdminClientTools(acting)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    const trackedCompanies = await prisma.trackedCompany.findMany({
      where: { userId: dbUser.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const template = await getPrompt("STRATEGY_INTAKE_PARSE");
    const prompt = fillIntakePrompt(template, notes, {
      user,
      profile: user.profile,
      trackedCompanies,
      intakeNotes: notes,
    });

    const { text, usage, modelId } = await kimchiGenerateText({
      tier: "parse",
      prompt,
      maxOutputTokens: 3500,
      userId: dbUser.id,
      tags: ["feature:strategy-intake"],
    });

    logAiUsage({
      userId: dbUser.id,
      feature: "strategy_intake",
      model: modelId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    }).catch(() => {});

    try {
      const parsed = parseIntakeJson(text);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "Failed to parse intake response" }, { status: 500 });
    }
  } catch (err) {
    console.error("[strategy-intake POST]", err);
    return anthropicErrorResponse(err);
  }
}

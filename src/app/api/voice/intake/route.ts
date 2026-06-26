import { getActingUser, quotaUserFor } from "@/lib/acting-user";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { anthropicErrorResponse } from "@/lib/anthropic-errors";
import { parseIntakeJson } from "@/lib/career-strategy";
import { fillIntakePrompt } from "@/lib/career-strategy-context";
import { deepgramConfigured, transcribeAudio } from "@/lib/deepgram";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { ensureProfileRow } from "@/lib/profile-write";
import { prisma } from "@/lib/prisma";
import { getPrompt } from "@/lib/prompts";
import { buildVoiceIntakeNotes } from "@/lib/voice-intake";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    transcriptionAvailable: deepgramConfigured(),
    agentAvailable: deepgramConfigured(),
    extractionAvailable: isKimchiAiConfigured(),
  });
}

export async function POST(request: Request) {
  if (!deepgramConfigured()) {
    return NextResponse.json({ error: "Voice transcription not configured" }, { status: 503 });
  }

  try {
    const acting = await getActingUser(request);
    const { dbUser } = acting;
    if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("audio");
    const applyToProfile = formData.get("apply") === "true";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Audio file is empty" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Audio file is too large (max 25MB)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { transcript, durationSeconds } = await transcribeAudio(buffer, file.type || "audio/webm");

    if (!isKimchiAiConfigured()) {
      return NextResponse.json({
        transcript,
        durationSeconds,
        summary: "",
        fieldsFound: [],
        proposed: {},
        parseSkipped: true,
        error: "AI extraction not configured",
      });
    }

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
    const prompt = fillIntakePrompt(template, transcript, {
      user,
      profile: user.profile,
      trackedCompanies,
      intakeNotes: transcript,
    });

    const { text, usage, modelId } = await kimchiGenerateText({
      tier: "parse",
      prompt,
      maxOutputTokens: 3500,
      userId: dbUser.id,
      tags: ["feature:voice-intake"],
    });

    logAiUsage({
      userId: dbUser.id,
      feature: "voice_intake",
      model: modelId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    }).catch(() => {});

    let parsed;
    try {
      parsed = parseIntakeJson(text);
    } catch {
      return NextResponse.json({ error: "Failed to parse voice intake response" }, { status: 500 });
    }

    if (applyToProfile) {
      const patch: Record<string, unknown> = { ...parsed.proposed };
      if (patch.name) {
        await prisma.user.update({ where: { id: dbUser.id }, data: { name: patch.name as string } });
        delete patch.name;
      }
      patch.strategyIntakeNotes = buildVoiceIntakeNotes(transcript, parsed);
      await prisma.profile.update({
        where: { id: user.profile.id },
        data: patch,
      });
    }

    return NextResponse.json({
      transcript,
      durationSeconds,
      ...parsed,
    });
  } catch (err) {
    console.error("[voice/intake POST]", err);
    if (err instanceof Error && err.message.includes("Deepgram")) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return anthropicErrorResponse(err);
  }
}

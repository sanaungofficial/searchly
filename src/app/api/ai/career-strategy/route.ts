import { getActingUser, quotaUserFor } from "@/lib/acting-user";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { fillStrategyPrompt } from "@/lib/career-strategy-context";
import {
  buildStrategySnapshot,
  diffStrategySnapshot,
  normalizeStrategyDocument,
  parseStrategyJson,
  type StrategySourceSnapshot,
} from "@/lib/career-strategy";
import { upsertProfileFields } from "@/lib/profile-write";
import { prisma } from "@/lib/prisma";
import { getPrompt } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const STRATEGY_MODEL = "claude-sonnet-4-6";

async function loadProfileBundle(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user?.profile) return null;

  const trackedCompanies = await prisma.trackedCompany.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  return { user, profile: user.profile, trackedCompanies };
}

export async function GET(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const bundle = await loadProfileBundle(dbUser.id);
  if (!bundle) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const { profile, trackedCompanies, user } = bundle;

  const currentSnapshot = buildStrategySnapshot({
    profile: {
      ...profile,
      targetRoles: profile.targetRoles ?? [],
      priorities: profile.priorities ?? [],
    },
    trackedCompanyNames: trackedCompanies.map((c) => c.name),
  });

  const storedSnapshot = profile.strategySourceSnapshot as StrategySourceSnapshot | null;
  const profileChanges = diffStrategySnapshot(storedSnapshot, currentSnapshot);

  if (!force && profile.strategyData) {
    return NextResponse.json({
      document: normalizeStrategyDocument(profile.strategyData),
      intakeNotes: profile.strategyIntakeNotes ?? "",
      updatedAt: profile.strategyUpdatedAt?.toISOString() ?? null,
      profileChanges,
      isStale: profileChanges.length > 0,
    });
  }

  if (!profile.resumeText?.trim()) {
    return NextResponse.json({ error: "Upload a resume before generating strategy" }, { status: 404 });
  }

  const quotaUser = quotaUserFor(await getActingUser(request));
  if (!quotaUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quotaError = await requireAiQuota(quotaUser, "STRATEGY");
  if (quotaError) return quotaError;

  const template = await getPrompt("CAREER_STRATEGY");
  const prompt = fillStrategyPrompt(template, {
    user,
    profile,
    trackedCompanies,
    intakeNotes: profile.strategyIntakeNotes,
  });

  const message = await getAnthropic().messages.create({
    model: STRATEGY_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  logAiUsage({
    userId: dbUser.id,
    feature: "career_strategy",
    model: STRATEGY_MODEL,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  }).catch(() => {});

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const document = parseStrategyJson(content.text);
    const now = new Date();
    const snapshot = buildStrategySnapshot({
      profile: {
        ...profile,
        targetRoles: profile.targetRoles ?? [],
        priorities: profile.priorities ?? [],
      },
      trackedCompanyNames: trackedCompanies.map((c) => c.name),
    });

    await upsertProfileFields(dbUser.id, {
      strategyData: document,
      strategyUpdatedAt: now,
      strategySourceSnapshot: snapshot,
      positioningStatement:
        profile.positioningStatement ||
        document.positioningStrategy.positioningStatement ||
        undefined,
    });

    return NextResponse.json({
      document,
      intakeNotes: profile.strategyIntakeNotes ?? "",
      updatedAt: now.toISOString(),
      profileChanges: [],
      isStale: false,
    });
  } catch {
    return NextResponse.json({ error: "Failed to parse strategy response" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { document, intakeNotes } = body as {
    document?: unknown;
    intakeNotes?: string;
  };

  const data: Record<string, unknown> = {};
  if (document !== undefined) {
    data.strategyData = normalizeStrategyDocument(document);
    data.strategyUpdatedAt = new Date();
  }
  if (intakeNotes !== undefined) {
    data.strategyIntakeNotes = intakeNotes;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  await upsertProfileFields(dbUser.id, data);

  return NextResponse.json({ ok: true });
}

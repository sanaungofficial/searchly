import { getActingUser, quotaUserFor } from "@/lib/acting-user";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { anthropicErrorResponse } from "@/lib/anthropic-errors";
import { fillStrategyPrompt } from "@/lib/career-strategy-context";
import {
  buildStrategySnapshot,
  diffStrategySnapshot,
  normalizeStrategyDocument,
  parseStrategyFromAi,
  salvagePartialStrategyJson,
  type StrategySourceSnapshot,
} from "@/lib/career-strategy";
import { upsertProfileFields, ensureProfileRow } from "@/lib/profile-write";
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

function strategyReadResponse(
  profile: NonNullable<Awaited<ReturnType<typeof loadProfileBundle>>>["profile"],
  trackedCompanies: { name: string }[],
) {
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
  const hasDocument = !!profile.strategyData;

  return {
    document: hasDocument ? normalizeStrategyDocument(profile.strategyData) : null,
    hasDocument,
    isPartial: !!storedSnapshot?.isPartialGeneration,
    intakeNotes: profile.strategyIntakeNotes ?? "",
    updatedAt: profile.strategyUpdatedAt?.toISOString() ?? null,
    profileChanges,
    isStale: hasDocument && profileChanges.length > 0,
  };
}

/** Read cached strategy + staleness — never calls AI. */
export async function GET(request: Request) {
  try {
    const { dbUser } = await getActingUser(request);
    if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const bundle = await loadProfileBundle(dbUser.id);
    if (!bundle) {
      return NextResponse.json({
        document: null,
        hasDocument: false,
        intakeNotes: "",
        updatedAt: null,
        profileChanges: [],
        isStale: false,
        isPartial: false,
      });
    }

    return NextResponse.json(strategyReadResponse(bundle.profile, bundle.trackedCompanies));
  } catch (err) {
    console.error("[career-strategy GET]", err);
    return NextResponse.json({ error: "Failed to load strategy" }, { status: 500 });
  }
}

/** Generate strategy — explicit action only; consumes STRATEGY credit. */
export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const acting = await getActingUser(request);
    const { dbUser } = acting;
    if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureProfileRow(dbUser.id);

    const bundle = await loadProfileBundle(dbUser.id);
    if (!bundle) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const { profile, trackedCompanies, user } = bundle;

    if (!profile.resumeText?.trim()) {
      return NextResponse.json({ error: "Upload a resume before generating strategy" }, { status: 404 });
    }

    const quotaUser = quotaUserFor(acting);
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
      max_tokens: 16384,
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
      const { document, isPartial } = parseStrategyFromAi(content.text);
      const now = new Date();
      const snapshot: StrategySourceSnapshot = {
        ...buildStrategySnapshot({
          profile: {
            ...profile,
            targetRoles: profile.targetRoles ?? [],
            priorities: profile.priorities ?? [],
          },
          trackedCompanyNames: trackedCompanies.map((c) => c.name),
        }),
        isPartialGeneration: isPartial || undefined,
      };

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
        ...strategyReadResponse(
          {
            ...profile,
            strategyData: document,
            strategyUpdatedAt: now,
            strategySourceSnapshot: snapshot,
          },
          trackedCompanies,
        ),
        document,
        updatedAt: now.toISOString(),
        isPartial,
        warning: isPartial
          ? "Generation was cut short — review the sections below, then regenerate when ready for the full document."
          : undefined,
      });
    } catch (parseErr) {
      const salvaged = salvagePartialStrategyJson(content.text);
      if (salvaged) {
        const now = new Date();
        const snapshot: StrategySourceSnapshot = {
          ...buildStrategySnapshot({
            profile: {
              ...profile,
              targetRoles: profile.targetRoles ?? [],
              priorities: profile.priorities ?? [],
            },
            trackedCompanyNames: trackedCompanies.map((c) => c.name),
          }),
          isPartialGeneration: true,
        };

        await upsertProfileFields(dbUser.id, {
          strategyData: salvaged,
          strategyUpdatedAt: now,
          strategySourceSnapshot: snapshot,
          positioningStatement:
            profile.positioningStatement ||
            salvaged.positioningStrategy.positioningStatement ||
            undefined,
        });

        return NextResponse.json({
          ...strategyReadResponse(
            {
              ...profile,
              strategyData: salvaged,
              strategyUpdatedAt: now,
              strategySourceSnapshot: snapshot,
            },
            trackedCompanies,
          ),
          document: salvaged,
          updatedAt: now.toISOString(),
          isPartial: true,
          warning:
            "Generation was cut short — we saved what was generated so you can review it without using another credit.",
        });
      }

      const truncated = message.stop_reason === "max_tokens";
      console.error("[career-strategy POST] parse failed", {
        stopReason: message.stop_reason,
        outputTokens: message.usage.output_tokens,
        err: parseErr,
        preview: content.text.slice(0, 400),
      });
      return NextResponse.json(
        {
          error: truncated
            ? "Strategy generation was cut off before finishing. Please try Generate again."
            : "Failed to parse strategy response. Please try again.",
        },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error("[career-strategy POST]", err);
    return anthropicErrorResponse(err);
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

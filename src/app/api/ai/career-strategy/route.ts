import { getActingUser, quotaUserFor } from "@/lib/acting-user";
import { requireAiQuota } from "@/lib/ai-guard";
import { anthropicErrorResponse } from "@/lib/anthropic-errors";
import {
  isStrategyGenerationRunning,
  runStrategyGeneration,
  startStrategyGeneration,
  strategyGenerationFields,
} from "@/lib/career-strategy-generate";
import {
  buildStrategySnapshot,
  diffStrategySnapshot,
  normalizeStrategyDocument,
  normalizeStrategyHistory,
  type StrategySourceSnapshot,
} from "@/lib/career-strategy";
import { upsertProfileFields, ensureProfileRow } from "@/lib/profile-write";
import { prisma } from "@/lib/prisma";
import { NextResponse, after } from "next/server";

export const maxDuration = 300;

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
  const generation = strategyGenerationFields(profile);
  const isPartial = !!storedSnapshot?.isPartialGeneration;

  return {
    document: hasDocument ? normalizeStrategyDocument(profile.strategyData) : null,
    hasDocument,
    isPartial,
    history: normalizeStrategyHistory(profile.strategyHistory),
    intakeNotes: profile.strategyIntakeNotes ?? "",
    updatedAt: profile.strategyUpdatedAt?.toISOString() ?? null,
    profileChanges,
    isStale: hasDocument && profileChanges.length > 0,
    ...generation,
    warning:
      generation.generationStatus === "complete" && isPartial
        ? "Generation was cut short — review the sections below, then regenerate when ready for the full document."
        : undefined,
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
        history: [],
        generationStatus: null,
        generationStartedAt: null,
        generationCompletedAt: null,
        generationError: null,
      });
    }

    return NextResponse.json(strategyReadResponse(bundle.profile, bundle.trackedCompanies));
  } catch (err) {
    console.error("[career-strategy GET]", err);
    return NextResponse.json({ error: "Failed to load strategy" }, { status: 500 });
  }
}

/** Start strategy generation in the background — consumes STRATEGY credit up front. */
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

    const { profile } = bundle;

    if (!profile.resumeText?.trim()) {
      return NextResponse.json({ error: "Upload a resume before generating strategy" }, { status: 404 });
    }

    if (
      isStrategyGenerationRunning(
        profile.strategyGenerationStatus as "running" | "complete" | "failed" | null,
        profile.strategyGenerationStartedAt,
      )
    ) {
      return NextResponse.json(
        {
          status: "running",
          generationStatus: "running",
          generationStartedAt: profile.strategyGenerationStartedAt?.toISOString() ?? null,
          message: "Strategy generation is already in progress.",
        },
        { status: 202 },
      );
    }

    const quotaUser = quotaUserFor(acting);
    if (!quotaUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const quotaError = await requireAiQuota(quotaUser, "STRATEGY");
    if (quotaError) return quotaError;

    const { startedAt } = await startStrategyGeneration(dbUser.id);
    const userId = dbUser.id;

    after(async () => {
      await runStrategyGeneration(userId).catch((err) => {
        console.error("[career-strategy after]", err);
      });
    });

    return NextResponse.json(
      {
        status: "running",
        generationStatus: "running",
        generationStartedAt: startedAt,
        message: "Strategy generation started. You can leave this page — we will keep working in the background.",
      },
      { status: 202 },
    );
  } catch (err) {
    console.error("[career-strategy POST]", err);
    return anthropicErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { document, intakeNotes, clearGenerationStatus } = body as {
    document?: unknown;
    intakeNotes?: string;
    clearGenerationStatus?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (document !== undefined) {
    data.strategyData = normalizeStrategyDocument(document);
    data.strategyUpdatedAt = new Date();
  }
  if (intakeNotes !== undefined) {
    data.strategyIntakeNotes = intakeNotes;
  }
  if (clearGenerationStatus) {
    data.strategyGenerationStatus = null;
    data.strategyGenerationError = null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  await upsertProfileFields(dbUser.id, data);

  return NextResponse.json({ ok: true });
}

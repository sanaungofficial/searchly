import { getActingUser, quotaUserFor, canAccessAdminClientTools } from "@/lib/acting-user";
import { readClientUserIdFromRequest, resolveAdminClientSubject } from "@/lib/admin-client-subject";
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
import { isKimchiAiConfigured } from "@/lib/llm";
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
  includeIntakeNotes: boolean,
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
    intakeNotes: includeIntakeNotes ? (profile.strategyIntakeNotes ?? "") : "",
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
    const acting = await getActingUser(request);
    if (!acting.authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clientUserId = readClientUserIdFromRequest(request);
    const resolved = await resolveAdminClientSubject(acting, clientUserId);
    if (resolved.error) return resolved.error;
    const dbUser = resolved.subject;
    if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const includeIntakeNotes = canAccessAdminClientTools(acting);

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

    return NextResponse.json(strategyReadResponse(bundle.profile, bundle.trackedCompanies, includeIntakeNotes));
  } catch (err) {
    console.error("[career-strategy GET]", err);
    return NextResponse.json({ error: "Failed to load strategy" }, { status: 500 });
  }
}

/** Start strategy generation in the background — consumes STRATEGY credit up front. */
export async function POST(request: Request) {
  try {
    if (!isKimchiAiConfigured()) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const acting = await getActingUser(request);
    if (!acting.authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canAccessAdminClientTools(acting)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clientUserId = readClientUserIdFromRequest(request);
    const resolved = await resolveAdminClientSubject(acting, clientUserId);
    if (resolved.error) return resolved.error;
    const dbUser = resolved.subject;
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
  const acting = await getActingUser(request);
  if (!acting.authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientUserId = readClientUserIdFromRequest(request);
  const resolved = await resolveAdminClientSubject(acting, clientUserId);
  if (resolved.error) return resolved.error;
  const dbUser = resolved.subject;
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
    if (!canAccessAdminClientTools(acting)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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

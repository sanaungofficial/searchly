import { logAiUsage } from "@/lib/ai-cost";
import { fillStrategyPrompt } from "@/lib/career-strategy-context";
import {
  archiveStrategyVersion,
  buildStrategySnapshot,
  parseStrategyFromAi,
  salvagePartialStrategyJson,
  type StrategySourceSnapshot,
} from "@/lib/career-strategy";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { upsertProfileFields } from "@/lib/profile-write";
import { prisma } from "@/lib/prisma";
import { getPrompt } from "@/lib/prompts";

const STALE_RUNNING_MS = 12 * 60 * 1000;

export type StrategyGenerationStatus = "running" | "complete" | "failed" | null;

export function normalizeStrategyGenerationStatus(value: unknown): StrategyGenerationStatus {
  if (value === "running" || value === "complete" || value === "failed") return value;
  return null;
}

export function isStrategyGenerationRunning(
  status: StrategyGenerationStatus,
  startedAt: Date | null | undefined,
): boolean {
  if (status !== "running") return false;
  if (!startedAt) return true;
  return Date.now() - startedAt.getTime() < STALE_RUNNING_MS;
}

export function strategyGenerationFields(profile: {
  strategyGenerationStatus?: string | null;
  strategyGenerationStartedAt?: Date | null;
  strategyGenerationCompletedAt?: Date | null;
  strategyGenerationError?: string | null;
}) {
  const status = normalizeStrategyGenerationStatus(profile.strategyGenerationStatus);
  const startedAt = profile.strategyGenerationStartedAt ?? null;
  const staleRunning = status === "running" && startedAt && Date.now() - startedAt.getTime() >= STALE_RUNNING_MS;

  return {
    generationStatus: staleRunning ? ("failed" as const) : status,
    generationStartedAt: startedAt?.toISOString() ?? null,
    generationCompletedAt: profile.strategyGenerationCompletedAt?.toISOString() ?? null,
    generationError: staleRunning
      ? "Generation timed out. Please try again."
      : profile.strategyGenerationError ?? null,
  };
}

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

async function markGenerationFailed(userId: string, error: string) {
  await upsertProfileFields(userId, {
    strategyGenerationStatus: "failed",
    strategyGenerationError: error.slice(0, 2000),
  });
}

export async function runStrategyGeneration(userId: string): Promise<void> {
  if (!isKimchiAiConfigured()) {
    await markGenerationFailed(userId, "AI not configured");
    return;
  }

  const bundle = await loadProfileBundle(userId);
  if (!bundle) {
    await markGenerationFailed(userId, "Profile not found");
    return;
  }

  const { profile, trackedCompanies, user } = bundle;

  if (!profile.resumeText?.trim()) {
    await markGenerationFailed(userId, "Upload a resume before generating strategy");
    return;
  }

  try {
    const template = await getPrompt("CAREER_STRATEGY");
    const prompt = fillStrategyPrompt(template, {
      user,
      profile,
      trackedCompanies,
      intakeNotes: profile.strategyIntakeNotes,
    });

    const { text, usage, modelId } = await kimchiGenerateText({
      tier: "create",
      prompt,
      maxOutputTokens: 16384,
      userId,
      tags: ["feature:career-strategy"],
    });

    logAiUsage({
      userId,
      feature: "career_strategy",
      model: modelId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    }).catch(() => {});

    try {
      const { document, isPartial } = parseStrategyFromAi(text);
      const now = new Date();
      const history = archiveStrategyVersion({
        currentDocument: profile.strategyData,
        currentUpdatedAt: profile.strategyUpdatedAt,
        existingHistory: profile.strategyHistory,
      });
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

      await upsertProfileFields(userId, {
        strategyData: document,
        strategyUpdatedAt: now,
        strategySourceSnapshot: snapshot,
        strategyHistory: history,
        positioningStatement:
          profile.positioningStatement ||
          document.positioningStrategy.positioningStatement ||
          undefined,
        strategyGenerationStatus: "complete",
        strategyGenerationCompletedAt: now,
        strategyGenerationError: null,
      });
      return;
    } catch (parseErr) {
      const salvaged = salvagePartialStrategyJson(text);
      if (salvaged) {
        const now = new Date();
        const history = archiveStrategyVersion({
          currentDocument: profile.strategyData,
          currentUpdatedAt: profile.strategyUpdatedAt,
          existingHistory: profile.strategyHistory,
        });
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

        await upsertProfileFields(userId, {
          strategyData: salvaged,
          strategyUpdatedAt: now,
          strategySourceSnapshot: snapshot,
          strategyHistory: history,
          positioningStatement:
            profile.positioningStatement ||
            salvaged.positioningStrategy.positioningStatement ||
            undefined,
          strategyGenerationStatus: "complete",
          strategyGenerationCompletedAt: now,
          strategyGenerationError: null,
        });
        return;
      }

      const truncated = usage.outputTokens >= 16384;
      console.error("[career-strategy generate] parse failed", {
        outputTokens: usage.outputTokens,
        err: parseErr,
        preview: text.slice(0, 400),
      });
      await markGenerationFailed(
        userId,
        truncated
          ? "Strategy generation was cut off before finishing. Please try Generate again."
          : "Failed to parse strategy response. Please try again.",
      );
    }
  } catch (err) {
    console.error("[career-strategy generate]", err);
    const message = err instanceof Error ? err.message : "Generation failed";
    await markGenerationFailed(userId, message);
  }
}

export async function startStrategyGeneration(userId: string): Promise<{ startedAt: string }> {
  const startedAt = new Date();
  await upsertProfileFields(userId, {
    strategyGenerationStatus: "running",
    strategyGenerationStartedAt: startedAt,
    strategyGenerationCompletedAt: null,
    strategyGenerationError: null,
  });
  return { startedAt: startedAt.toISOString() };
}

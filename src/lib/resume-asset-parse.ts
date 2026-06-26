import { logAiUsage } from "@/lib/ai-usage";
import {
  getLegacyAnthropicClient,
  hasLegacyAnthropicClient,
  isKimchiAiConfigured,
  kimchiModelId,
} from "@/lib/llm";
import { getPrompt } from "@/lib/prompts";
import { shouldReplaceNameWithResumeName } from "@/lib/resume-parse";
import {
  extractRawResumeText,
  fetchResumeBytes,
  fileExtFromUrl,
  parseResumeFile,
} from "@/lib/resume-extract";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const STALE_PARSE_MS = 12 * 60 * 1000;

export type ResumeParseStatus = "running" | "complete" | "failed" | null;

export function normalizeResumeParseStatus(value: unknown): ResumeParseStatus {
  if (value === "running" || value === "complete" || value === "failed") return value;
  return null;
}

export function isResumeParseRunning(
  status: ResumeParseStatus,
  startedAt: Date | null | undefined,
): boolean {
  if (status !== "running") return false;
  if (!startedAt) return true;
  return Date.now() - startedAt.getTime() < STALE_PARSE_MS;
}

export function resumeParseFields(asset: {
  parseStatus?: string | null;
  parseStartedAt?: Date | null;
  parseCompletedAt?: Date | null;
  parseError?: string | null;
}) {
  const status = normalizeResumeParseStatus(asset.parseStatus);
  const startedAt = asset.parseStartedAt ?? null;
  const stale = status === "running" && startedAt && Date.now() - startedAt.getTime() >= STALE_PARSE_MS;

  return {
    parseStatus: stale ? ("failed" as const) : status,
    parseStartedAt: startedAt?.toISOString() ?? null,
    parseCompletedAt: asset.parseCompletedAt?.toISOString() ?? null,
    parseError: stale ? "Resume analysis timed out. Please try uploading again." : asset.parseError ?? null,
  };
}

export async function runResumeAssetParse(assetId: string, userId: string): Promise<void> {
  const asset = await prisma.userAsset.findFirst({
    where: { id: assetId, userId, type: "RESUME" },
  });
  if (!asset) return;

  try {
    const bytes = await fetchResumeBytes(asset.url);
    if (!bytes) {
      await prisma.userAsset.update({
        where: { id: assetId },
        data: { parseStatus: "failed", parseError: "Could not read uploaded file." },
      });
      return;
    }

    const ext = fileExtFromUrl(asset.url);
    const anthropic = hasLegacyAnthropicClient() ? getLegacyAnthropicClient() : null;
    const structuredPrompt =
      isKimchiAiConfigured() || anthropic ? await getPrompt("RESUME_PARSE") : "";
    const { text: resumeText, parsed, tokensIn, tokensOut } = await parseResumeFile(
      anthropic,
      bytes,
      ext,
      structuredPrompt,
      asset.name,
      userId,
    );

    const text = resumeText.trim() || (await extractRawResumeText(bytes, ext));
    if (!text.trim()) {
      await prisma.userAsset.update({
        where: { id: assetId },
        data: { parseStatus: "failed", parseError: "Could not extract text from this file." },
      });
      return;
    }

    if (tokensIn > 0) {
      logAiUsage(userId, "RESUME_PARSE", await kimchiModelId("parse"), tokensIn, tokensOut);
    }

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    const extractedName = parsed?.name;
    if (
      dbUser &&
      extractedName &&
      shouldReplaceNameWithResumeName(dbUser.name, dbUser.email, dbUser.name ?? undefined)
    ) {
      await prisma.user.update({ where: { id: userId }, data: { name: extractedName } });
    }

    const now = new Date();
    await prisma.userAsset.update({
      where: { id: assetId },
      data: {
        resumeText: text,
        parsedData: (parsed ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
        parseStatus: "complete",
        parseCompletedAt: now,
        parseError: null,
      },
    });

    const updated = await prisma.userAsset.findUnique({ where: { id: assetId } });
    if (updated?.isPrimary) {
      await syncPrimaryResumeToProfile(userId);
    }
  } catch (err) {
    console.error("[resume-asset-parse]", err);
    await prisma.userAsset.update({
      where: { id: assetId },
      data: {
        parseStatus: "failed",
        parseError: err instanceof Error ? err.message.slice(0, 500) : "Resume analysis failed.",
      },
    });
  }
}

import { getActingUser } from "@/lib/acting-user";
import { requireAiQuota } from "@/lib/ai-guard";
import { ensureAssetResumeParsed } from "@/lib/ensure-asset-resume";
import { getOwnedAssetForActingUser } from "@/lib/owned-asset";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { isKimchiAiConfigured, kimchiGenerateText, kimchiModelId } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { parseResumeFromText } from "@/lib/resume-extract";
import {
  hasResumeBodyContent,
  normalizeParsedResumeData,
  parseJsonFromModel,
  type ParsedResumeData,
} from "@/lib/resume-parse";
import { resumeTextFromAsset } from "@/lib/resolve-resume-text";
import { normalizeQualityScore } from "@/components/scout/profile-resume-analysis-report";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const { authUser } = await getActingUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedAssetForActingUser(id, request);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { dbUser, asset } = owned;
  const quotaError = await requireAiQuota(dbUser, "TAILOR");
  if (quotaError) return quotaError;

  let workingAsset = asset;
  let parsed = normalizeParsedResumeData(workingAsset.parsedData);
  if (!parsed || !hasResumeBodyContent(parsed)) {
    const ensured = await ensureAssetResumeParsed(id, dbUser.id);
    if (ensured) {
      workingAsset = ensured;
      parsed = normalizeParsedResumeData(workingAsset.parsedData);
    }
  }
  if (!parsed || !hasResumeBodyContent(parsed)) {
    const resumeText = resumeTextFromAsset(workingAsset);
    if (resumeText) {
      const structuredPrompt = isKimchiAiConfigured() ? await getPrompt("RESUME_PARSE") : "";
      const { parsed: fromText, tokensIn, tokensOut, modelId } = await parseResumeFromText(
        resumeText,
        structuredPrompt,
        dbUser.id,
      );
      if (fromText && hasResumeBodyContent(fromText)) {
        parsed = fromText;
        workingAsset = await prisma.userAsset.update({
          where: { id },
          data: { parsedData: fromText as unknown as Prisma.InputJsonValue },
        });
        if (tokensIn > 0) {
          logAiUsage(dbUser.id, "RESUME_PARSE", modelId || (await kimchiModelId("parse")), tokensIn, tokensOut);
        }
      }
    }
  }
  if (!parsed || !hasResumeBodyContent(parsed)) {
    return NextResponse.json({ error: "No resume data — try Reparse in the resume editor" }, { status: 404 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const analysis = (workingAsset.analysisData ?? {}) as Record<string, unknown>;
  const improvements = Array.isArray(analysis.improvements) ? analysis.improvements : [];
  const gaps = Array.isArray(analysis.gaps) ? analysis.gaps : [];
  const tips = Array.isArray(analysis.tips) ? analysis.tips : [];
  const issuesPayload =
    improvements.length > 0
      ? improvements
      : gaps.map((gap, i) => ({
          priority: i === 0 ? "Urgent" : "Optional",
          title: gap,
          detail: tips[i] ?? "",
        }));

  const targetRoles =
    (profile?.targetRoles as string[] | null)?.join(", ") || "general professional roles";

  const template = await getPrompt("RESUME_BULK_IMPROVE");
  const prompt = interpolate(template, {
    resumeJson: JSON.stringify(parsed).slice(0, 12000),
    issuesJson: JSON.stringify(issuesPayload).slice(0, 6000),
    targetRoles,
  });

  let text: string;
  let usage: { inputTokens: number; outputTokens: number };
  let modelId: string;
  let finishReason: string | null;
  try {
    ({ text, usage, modelId, finishReason } = await kimchiGenerateText({
      tier: "create",
      prompt,
      maxOutputTokens: 8192,
      userId: dbUser.id,
      tags: ["feature:resume-bulk-improve"],
    }));
  } catch (err) {
    console.error("[assets/improve POST]", err);
    const message = err instanceof Error ? err.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  logAiUsage(dbUser.id, "TAILOR", modelId, usage.inputTokens, usage.outputTokens);

  const result = parseJsonFromModel(text) as {
    parsedData?: ParsedResumeData;
    changes?: string[];
    highlights?: Array<{
      sectionId?: string;
      label?: string;
      before?: string;
      after?: string;
      reason?: string;
    }>;
    newScore?: number;
  } | null;

  if (!result?.parsedData) {
    const truncated = finishReason === "length" || finishReason === "max_tokens";
    return NextResponse.json(
      {
        error: truncated
          ? "Improvement generation was cut off before finishing — try again."
          : "Failed to parse improved resume — try Reparse in the resume editor, then try again.",
      },
      { status: 500 },
    );
  }

  const improved = normalizeParsedResumeData(result.parsedData);
  if (!improved) {
    return NextResponse.json({ error: "Invalid improved resume structure" }, { status: 500 });
  }

  if (parsed.resumeStyle) improved.resumeStyle = parsed.resumeStyle;

  return NextResponse.json({
    parsedData: improved,
    changes: Array.isArray(result.changes) ? result.changes.filter((c) => typeof c === "string") : [],
    highlights: Array.isArray(result.highlights) ? result.highlights : [],
    newScore: normalizeQualityScore(result.newScore),
    previousScore: normalizeQualityScore(typeof analysis.score === "number" ? analysis.score : undefined),
  });
}

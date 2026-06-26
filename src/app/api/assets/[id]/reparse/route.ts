import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import {
  getLegacyAnthropicClient,
  hasLegacyAnthropicClient,
  isKimchiAiConfigured,
  kimchiModelId,
} from "@/lib/llm";
import { getPrompt } from "@/lib/prompts";
import { normalizeParsedResumeData, type ParsedResumeData } from "@/lib/resume-parse";
import { hydrateResumeAsset } from "@/lib/ensure-asset-resume";
import {
  fetchResumeBytes,
  fileExtFromUrl,
  extractRawResumeText,
  parseResumeFile,
  parseResumeFromText,
} from "@/lib/resume-extract";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const asset = await hydrateResumeAsset(id, dbUser.id);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let resumeText = asset.resumeText?.trim() || "";
  let bytes: Buffer | null = null;

  if (asset.url) {
    bytes = await fetchResumeBytes(asset.url);
    if (!resumeText && bytes) {
      resumeText = await extractRawResumeText(bytes, fileExtFromUrl(asset.url));
    }
  }

  if (!resumeText) {
    return NextResponse.json({ error: "No resume text or PDF to parse" }, { status: 404 });
  }

  const anthropic = hasLegacyAnthropicClient() ? getLegacyAnthropicClient() : null;
  const structuredPrompt =
    isKimchiAiConfigured() || anthropic ? await getPrompt("RESUME_PARSE") : "";
  const ext = asset.url ? fileExtFromUrl(asset.url) : "txt";

  let parsed: ParsedResumeData | null = null;
  let tokensIn = 0;
  let tokensOut = 0;
  let usedFallback = false;
  let provider: "hirebase" | "claude" | "heuristic" = "heuristic";
  let modelId = kimchiModelId("parse");

  if (bytes) {
    const result = await parseResumeFile(anthropic, bytes, ext, structuredPrompt, asset.name, dbUser.id);
    resumeText = result.text || resumeText;
    parsed = result.parsed;
    tokensIn = result.tokensIn;
    tokensOut = result.tokensOut;
    usedFallback = result.usedFallback;
    provider = result.provider;
  } else {
    const result = await parseResumeFromText(resumeText, structuredPrompt, dbUser.id);
    parsed = result.parsed;
    tokensIn = result.tokensIn;
    tokensOut = result.tokensOut;
    usedFallback = result.usedFallback;
    provider = result.provider;
    if (result.modelId) modelId = result.modelId;
  }

  if (!parsed) {
    return NextResponse.json({ error: "Could not parse resume" }, { status: 422 });
  }

  if (tokensIn > 0) {
    logAiUsage(dbUser.id, "RESUME_PARSE", modelId, tokensIn, tokensOut);
  }

  const updated = await prisma.userAsset.update({
    where: { id },
    data: {
      parsedData: parsed as unknown as Prisma.InputJsonValue,
      resumeText,
    },
  });

  if (updated.isPrimary) {
    await syncPrimaryResumeToProfile(dbUser.id);
  }

  return NextResponse.json({
    parsedData: normalizeParsedResumeData(updated.parsedData),
    _fallback: usedFallback,
    _provider: provider,
  });
}

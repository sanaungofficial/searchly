import { resolveScopedDbUser } from "@/lib/admin-client-subject";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-usage";
import {
  buildContextSuggestionChips,
  parseAiFollowUpChips,
  type AssistantChip,
} from "@/lib/kimchi-assistant/chat-chips";
import { buildAssistantContext, formatAssistantContextForPrompt } from "@/lib/kimchi-assistant/context";
import type { AssistantPageHint } from "@/lib/kimchi-assistant/types";
import { getKimchiAiSettings } from "@/lib/kimchi-ai-settings";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function formatProfileGaps(gaps: {
  hasStrategyDoc: boolean;
  hasResume: boolean;
  hasPipelineJobs: boolean;
  emailConnected: boolean;
}): string {
  return [
    gaps.hasStrategyDoc ? "- Has career strategy doc" : "- Missing career strategy doc",
    gaps.hasResume ? "- Has resume on file" : "- Missing resume",
    gaps.hasPipelineJobs ? "- Has jobs in pipeline" : "- Pipeline empty",
    gaps.emailConnected ? "- Email connected" : "- Email not connected",
  ].join("\n");
}

export async function POST(request: Request) {
  const { dbUser, error } = await resolveScopedDbUser(request);
  if (error) return error;
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    pageHint?: AssistantPageHint;
  };

  const user = await prisma.user.findUnique({
    where: { id: dbUser.id },
    include: { profile: true, subscription: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const assistantCtx = await buildAssistantContext({ user, pageHint: body.pageHint });
  const fallbackChips = buildContextSuggestionChips(assistantCtx);
  const settings = await getKimchiAiSettings();

  if (!settings.autoForYouOnOpen || !isKimchiAiConfigured()) {
    return NextResponse.json({ chips: fallbackChips, opener: null, source: "rules" });
  }

  const quotaError = await requireAiQuota(dbUser, "SCOUT");
  if (quotaError) {
    return NextResponse.json({ chips: fallbackChips, opener: null, source: "rules" });
  }

  try {
    const template = await getPrompt("KIMCHI_FOR_YOU");
    const prompt = interpolate(template, {
      summary: assistantCtx.summary,
      profileGaps: formatProfileGaps(assistantCtx.profileGaps),
      contextBlock: formatAssistantContextForPrompt(assistantCtx).slice(0, 4500),
    });

    const { text, usage, modelId } = await kimchiGenerateText({
      tier: "talk",
      prompt,
      maxOutputTokens: 550,
      userId: dbUser.id,
      tags: ["feature:kimchi-for-you"],
    });

    logAiUsage(dbUser.id, "CHAT", modelId, usage.inputTokens, usage.outputTokens);

    const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, "")) as {
      opener?: string;
      chips?: unknown;
    };
    const aiChips = parseAiFollowUpChips(parsed);

    if (aiChips.length >= 2) {
      return NextResponse.json({
        chips: aiChips as AssistantChip[],
        opener: typeof parsed.opener === "string" ? parsed.opener.trim().slice(0, 160) : null,
        source: "ai",
      });
    }
  } catch {
    /* fallback */
  }

  return NextResponse.json({ chips: fallbackChips, opener: null, source: "rules" });
}

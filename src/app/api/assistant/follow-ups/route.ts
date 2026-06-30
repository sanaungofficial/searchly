import { getActingUser } from "@/lib/acting-user";
import {
  buildFollowUpChips,
  formatThreadForFollowUps,
  isFailedAssistantReply,
  parseAiFollowUpChips,
  type AssistantChip,
} from "@/lib/kimchi-assistant/chat-chips";
import { followUpStringsToChips, generateAiSuggestedFollowUps } from "@/lib/kimchi-assistant/chat-follow-ups";
import { buildAssistantContext } from "@/lib/kimchi-assistant/context";
import type { AssistantProfileGaps } from "@/lib/kimchi-assistant/types";
import { isKimchiAiConfigured } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function formatProfileGaps(gaps: AssistantProfileGaps): string {
  const lines = [
    gaps.hasStrategyDoc ? "- Has career strategy doc" : "- Missing career strategy doc (suggest Create your strategy)",
    gaps.hasResume ? "- Has resume on file" : "- Missing resume (suggest upload)",
    gaps.hasPipelineJobs ? "- Has jobs in pipeline" : "- Pipeline empty (suggest add jobs)",
    gaps.emailConnected ? "- Email connected" : "- Email not connected (suggest /networking/inbox)",
  ];
  return lines.join("\n");
}

export async function POST(request: Request) {
  const { dbUser } = await getActingUser(request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    userMessage?: string;
    assistantMessage?: string;
    threadContext?: string;
    threadMessages?: Array<{ role: string; content: string }>;
    profileGaps?: AssistantProfileGaps;
    strategySnippet?: string;
    pipelineSnippet?: string;
    /** When true, run AI to suggest chips. Default is rule-based only (no credits). */
    useAi?: boolean;
  };

  const userMessage = body.userMessage?.trim() ?? "";
  const assistantMessage = body.assistantMessage?.trim() ?? "";

  if (!assistantMessage) {
    return NextResponse.json({ chips: [] });
  }

  const threadContext =
    body.threadContext?.trim() ||
    (body.threadMessages?.length ? formatThreadForFollowUps(body.threadMessages) : "");

  let profileGaps = body.profileGaps;
  let strategySnippet = body.strategySnippet ?? "";
  let pipelineSnippet = body.pipelineSnippet ?? "";
  let assistantCtx = null as Awaited<ReturnType<typeof buildAssistantContext>> | null;

  if (!profileGaps || (!strategySnippet && !pipelineSnippet)) {
    const user = await prisma.user.findUnique({
      where: { id: dbUser.id },
      include: { profile: true, subscription: true },
    });
    if (user) {
      assistantCtx = await buildAssistantContext({ user });
      profileGaps = profileGaps ?? assistantCtx.profileGaps;
      strategySnippet = strategySnippet || assistantCtx.strategySnippet;
      pipelineSnippet = pipelineSnippet || assistantCtx.pipelineSnippet;
    }
  }

  const fallback = buildFollowUpChips({
    userMessage,
    assistantMessage,
    threadContext,
  });

  if (!body.useAi) {
    return NextResponse.json({ chips: fallback, suggestedFollowUps: chipsToStrings(fallback) });
  }

  if (
    isFailedAssistantReply(assistantMessage) ||
    !isKimchiAiConfigured() ||
    assistantMessage.length < 48
  ) {
    return NextResponse.json({ chips: fallback, suggestedFollowUps: chipsToStrings(fallback) });
  }

  try {
    const suggestedFollowUps = await generateAiSuggestedFollowUps({
      userMessage,
      assistantMessage,
      threadContext,
      userId: dbUser.id,
    });

    if (suggestedFollowUps.length >= 2) {
      const chips = followUpStringsToChips(suggestedFollowUps);
      return NextResponse.json({ chips, suggestedFollowUps });
    }

    const template = await getPrompt("KIMCHI_CHAT_FOLLOW_UPS");
    const prompt = interpolate(template, {
      userMessage: userMessage.slice(0, 500),
      assistantMessage: assistantMessage.slice(0, 2000),
      threadContext: threadContext.slice(0, 3500),
      profileGaps: profileGaps ? formatProfileGaps(profileGaps) : "Unknown",
      strategySnippet: strategySnippet.slice(0, 800),
      pipelineSnippet: pipelineSnippet.slice(0, 800),
    });

    const { kimchiGenerateText } = await import("@/lib/llm");
    const { text } = await kimchiGenerateText({
      tier: "talk",
      prompt,
      maxOutputTokens: 450,
      userId: dbUser.id,
      tags: ["feature:chat-follow-ups"],
    });

    const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, ""));
    const aiChips = parseAiFollowUpChips(parsed);

    if (aiChips.length >= 2) {
      return NextResponse.json({
        chips: aiChips as AssistantChip[],
        suggestedFollowUps: aiChips
          .filter((c) => c.action.type === "chat")
          .map((c) => (c.action.type === "chat" ? c.action.prompt : c.label)),
      });
    }
  } catch {
    /* use fallback */
  }

  return NextResponse.json({ chips: fallback, suggestedFollowUps: chipsToStrings(fallback) });
}

function chipsToStrings(chips: AssistantChip[]): string[] {
  return chips
    .filter((c) => c.action.type === "chat")
    .map((c) => (c.action.type === "chat" ? c.action.prompt : c.label))
    .slice(0, 4);
}

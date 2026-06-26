import { getActingUser } from "@/lib/acting-user";
import {
  buildFollowUpChips,
  formatThreadForFollowUps,
  isFailedAssistantReply,
  parseAiFollowUpChips,
  type AssistantChip,
} from "@/lib/kimchi-assistant/chat-chips";
import { buildAssistantContext } from "@/lib/kimchi-assistant/context";
import type { AssistantProfileGaps } from "@/lib/kimchi-assistant/types";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function formatProfileGaps(gaps: AssistantProfileGaps): string {
  const lines = [
    gaps.hasStrategyDoc ? "- Has career strategy doc" : "- Missing career strategy doc (suggest Create your strategy)",
    gaps.hasResume ? "- Has resume on file" : "- Missing resume (suggest upload)",
    gaps.hasPipelineJobs ? "- Has jobs in pipeline" : "- Pipeline empty (suggest add jobs)",
    gaps.emailConnected ? "- Email connected" : "- Email not connected (suggest /inbox)",
  ];
  return lines.join("\n");
}

export async function POST(request: Request) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    userMessage?: string;
    assistantMessage?: string;
    threadContext?: string;
    threadMessages?: Array<{ role: string; content: string }>;
    profileGaps?: AssistantProfileGaps;
    strategySnippet?: string;
    pipelineSnippet?: string;
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

  if (!profileGaps || (!strategySnippet && !pipelineSnippet)) {
    const user = await prisma.user.findUnique({
      where: { id: dbUser.id },
      include: { profile: true, subscription: true },
    });
    if (user) {
      const assistantCtx = await buildAssistantContext({ user });
      profileGaps = profileGaps ?? assistantCtx.profileGaps;
      strategySnippet = strategySnippet || assistantCtx.strategySnippet;
      pipelineSnippet = pipelineSnippet || assistantCtx.pipelineSnippet;
    }
  }

  const fallback = buildFollowUpChips({
    userMessage,
    assistantMessage,
    threadContext,
    profileGaps,
  });

  if (
    isFailedAssistantReply(assistantMessage) ||
    !isKimchiAiConfigured() ||
    assistantMessage.length < 48
  ) {
    return NextResponse.json({ chips: fallback });
  }

  try {
    const template = await getPrompt("KIMCHI_CHAT_FOLLOW_UPS");
    const prompt = interpolate(template, {
      userMessage: userMessage.slice(0, 500),
      assistantMessage: assistantMessage.slice(0, 2000),
      threadContext: threadContext.slice(0, 3500),
      profileGaps: profileGaps ? formatProfileGaps(profileGaps) : "Unknown",
      strategySnippet: strategySnippet.slice(0, 800),
      pipelineSnippet: pipelineSnippet.slice(0, 800),
    });

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
      return NextResponse.json({ chips: aiChips as AssistantChip[] });
    }
  } catch {
    /* use fallback */
  }

  return NextResponse.json({ chips: fallback });
}

import type { AssistantChip } from "@/lib/kimchi-assistant/chat-chips";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";

export const KIMCHI_FOLLOWUPS_MARKER = /<!--kimchi-followups:([\s\S]*?)-->/;

export function stripKimchiFollowUpsMarker(text: string): {
  text: string;
  suggestedFollowUps: string[];
} {
  const match = text.match(KIMCHI_FOLLOWUPS_MARKER);
  if (!match) return { text, suggestedFollowUps: [] };

  let suggestedFollowUps: string[] = [];
  try {
    const parsed = JSON.parse(match[1] ?? "[]");
    if (Array.isArray(parsed)) {
      suggestedFollowUps = parsed
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 120))
        .slice(0, 4);
    }
  } catch {
    /* ignore malformed marker */
  }

  return {
    text: text.replace(KIMCHI_FOLLOWUPS_MARKER, "").trimEnd(),
    suggestedFollowUps,
  };
}

export function formatKimchiFollowUpsMarker(followUps: string[]): string {
  if (!followUps.length) return "";
  return `\n<!--kimchi-followups:${JSON.stringify(followUps.slice(0, 4))}-->`;
}

export function followUpStringsToChips(strings: string[]): AssistantChip[] {
  return strings.slice(0, 4).map((raw, i) => {
    const label = raw.trim().slice(0, 78);
    return {
      id: `followup-${i}`,
      label,
      variant: "chat" as const,
      tone: "neutral" as const,
      action: { type: "chat" as const, prompt: raw.trim().slice(0, 400) },
    };
  });
}

export async function generateAiSuggestedFollowUps(params: {
  userMessage: string;
  assistantMessage: string;
  threadContext?: string;
  userId: string;
}): Promise<string[]> {
  if (
    !isKimchiAiConfigured() ||
    params.assistantMessage.trim().length < 48
  ) {
    return [];
  }

  try {
    const template = await getPrompt("KIMCHI_CHAT_FOLLOW_UP_STRINGS");
    const prompt = interpolate(template, {
      userMessage: params.userMessage.slice(0, 500),
      assistantMessage: params.assistantMessage.slice(0, 2000),
      threadContext: (params.threadContext ?? "").slice(0, 3500),
    });

    const { text } = await kimchiGenerateText({
      tier: "talk",
      prompt,
      maxOutputTokens: 280,
      userId: params.userId,
      tags: ["feature:chat-follow-ups"],
    });

    const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, "")) as {
      suggestedFollowUps?: unknown;
    };

    if (!Array.isArray(parsed.suggestedFollowUps)) return [];

    return parsed.suggestedFollowUps
      .filter((s): s is string => typeof s === "string" && s.trim().length > 3)
      .map((s) => s.trim().slice(0, 120))
      .slice(0, 4);
  } catch {
    return [];
  }
}

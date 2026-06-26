import { getActingUser } from "@/lib/acting-user";
import { buildFollowUpChips } from "@/lib/kimchi-assistant/chat-chips";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Chip = { id: string; label: string; prompt: string };

export async function POST(request: Request) {
  const { dbUser } = await getActingUser();
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    userMessage?: string;
    assistantMessage?: string;
  };

  const userMessage = body.userMessage?.trim() ?? "";
  const assistantMessage = body.assistantMessage?.trim() ?? "";

  if (!assistantMessage) {
    return NextResponse.json({ chips: [] });
  }

  const fallback = buildFollowUpChips({ userMessage, assistantMessage });

  if (!isKimchiAiConfigured() || assistantMessage.length < 40) {
    return NextResponse.json({ chips: fallback });
  }

  try {
    const template = await getPrompt("KIMCHI_CHAT_FOLLOW_UPS");
    const prompt = interpolate(template, {
      userMessage: userMessage.slice(0, 500),
      assistantMessage: assistantMessage.slice(0, 2000),
    });

    const { text } = await kimchiGenerateText({
      tier: "talk",
      prompt,
      maxOutputTokens: 450,
      userId: dbUser.id,
      tags: ["feature:chat-follow-ups"],
    });

    const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, "")) as { chips?: Chip[] };
    const chips = Array.isArray(parsed.chips)
      ? parsed.chips
          .filter((c) => c.label && c.prompt)
          .slice(0, 5)
          .map((c, i) => ({
            id: c.id || `ai-${i}`,
            label: c.label.slice(0, 48),
            variant: "chat" as const,
            action: { type: "chat" as const, prompt: c.prompt.slice(0, 400) },
          }))
      : [];

    if (chips.length >= 2) {
      return NextResponse.json({ chips });
    }
  } catch {
    /* use fallback */
  }

  return NextResponse.json({ chips: fallback });
}

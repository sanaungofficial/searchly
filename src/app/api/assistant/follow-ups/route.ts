import { getActingUser } from "@/lib/acting-user";
import { buildFollowUpChips } from "@/lib/kimchi-assistant/chat-chips";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
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
    const { text } = await kimchiGenerateText({
      tier: "talk",
      prompt: `You suggest 3 short follow-up prompts for a job seeker chatting with Kimchi.

Return ONLY valid JSON:
{ "chips": [{ "id": "unique", "label": "3-6 word button label", "prompt": "full user message to send Kimchi" }] }

Rules:
- Labels are clickable chips — short, specific, related to the assistant's last reply
- Prompts are what the user would type to drill deeper
- No generic "tell me more" unless nothing else fits

User asked: ${userMessage.slice(0, 500)}
Kimchi replied: ${assistantMessage.slice(0, 2000)}`,
      maxOutputTokens: 350,
      userId: dbUser.id,
      tags: ["feature:chat-follow-ups"],
    });

    const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, "")) as { chips?: Chip[] };
    const chips = Array.isArray(parsed.chips)
      ? parsed.chips
          .filter((c) => c.label && c.prompt)
          .slice(0, 4)
          .map((c, i) => ({
            id: c.id || `ai-${i}`,
            label: c.label.slice(0, 48),
            prompt: c.prompt.slice(0, 400),
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

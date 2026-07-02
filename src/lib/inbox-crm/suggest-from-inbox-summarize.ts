import { InboxActivityKind } from "@prisma/client";
import { logAiUsage } from "@/lib/ai-usage";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { extractJsonObject } from "@/lib/nylas-smart-compose";
import { prisma } from "@/lib/prisma";
import { getPrompt, interpolate } from "@/lib/prompts";

const MAX_ACTIVITIES_PER_CONTACT = 8;
const MAX_SNIPPET_CHARS = 120;

type ActivityRow = {
  kind: InboxActivityKind;
  subject: string | null;
  snippet: string | null;
  occurredAt: Date | null;
};

function formatActivityLine(row: ActivityRow): string {
  const date = row.occurredAt
    ? row.occurredAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "unknown date";
  const kind = row.kind === InboxActivityKind.MEETING ? "Meeting" : "Email";
  const subject = row.subject?.trim() || "(no subject)";
  const snippet = row.snippet?.trim().slice(0, MAX_SNIPPET_CHARS);
  return snippet
    ? `- ${date} · ${kind}: "${subject}" — ${snippet}`
    : `- ${date} · ${kind}: "${subject}"`;
}

function buildContactContextBlock(name: string, email: string, activities: ActivityRow[]): string {
  const lines = activities.slice(0, MAX_ACTIVITIES_PER_CONTACT).map(formatActivityLine);
  return [`Contact: ${name} <${email}>`, "Activity (metadata only):", ...lines].join("\n");
}

export async function summarizeInboxContactContexts(
  userId: string,
  emails: string[],
): Promise<{ summaries: Record<string, string>; aiAvailable: boolean; message?: string }> {
  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) {
    return { summaries: {}, aiAvailable: isKimchiAiConfigured() };
  }

  if (!isKimchiAiConfigured()) {
    return {
      summaries: {},
      aiAvailable: false,
      message: "AI summaries need production — connect on kimchi.so or wait for a prod build with API keys.",
    };
  }

  const contacts = await prisma.inboxContact.findMany({
    where: { userId, email: { in: normalized } },
    select: {
      email: true,
      name: true,
      activities: {
        orderBy: { occurredAt: "desc" },
        take: MAX_ACTIVITIES_PER_CONTACT,
        select: {
          kind: true,
          subject: true,
          snippet: true,
          occurredAt: true,
        },
      },
    },
  });

  const byEmail = new Map(contacts.map((c) => [c.email.toLowerCase(), c]));
  const blocks: string[] = [];

  for (const email of normalized) {
    const contact = byEmail.get(email);
    if (!contact) continue;
    const name = contact.name?.trim() || email;
    blocks.push(buildContactContextBlock(name, email, contact.activities));
    blocks.push("");
  }

  if (blocks.length === 0) {
    return { summaries: {}, aiAvailable: true };
  }

  const template = await getPrompt("KIMCHI_INBOX_CONTACT_CONTEXT");
  const prompt = interpolate(template, {
    contacts: blocks.join("\n").trim(),
  });

  try {
    const { text, usage, modelId } = await kimchiGenerateText({
      tier: "talk",
      prompt,
      maxOutputTokens: Math.min(256 * normalized.length, 2048),
      userId,
      tags: ["feature:inbox-contact-context"],
    });

    logAiUsage(userId, "CHAT", modelId, usage.inputTokens, usage.outputTokens);

    const parsed = extractJsonObject(text) as { summaries?: Record<string, string> } | null;
    const summaries: Record<string, string> = {};
    if (parsed?.summaries && typeof parsed.summaries === "object") {
      for (const [key, value] of Object.entries(parsed.summaries)) {
        if (typeof value === "string" && value.trim()) {
          summaries[key.trim().toLowerCase()] = value.trim();
        }
      }
    }

    return { summaries, aiAvailable: true };
  } catch (err) {
    console.error("[suggest-from-inbox/summarize]", err);
    return {
      summaries: {},
      aiAvailable: true,
      message: "Could not generate summaries — try again.",
    };
  }
}

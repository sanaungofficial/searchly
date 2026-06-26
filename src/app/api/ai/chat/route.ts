import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-usage";
import { buildAssistantContext, formatAssistantContextForPrompt } from "@/lib/kimchi-assistant/context";
import { buildKimchiMailTools, wantsMailTools } from "@/lib/kimchi-assistant/mail/chat-tools";
import { isKimchiAiConfigured, kimchiStreamText, kimchiStreamTextWithTools } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { prisma } from "@/lib/prisma";

const MAIL_TOOL_GUIDE = `
You can act on the user's connected inbox and calendar using tools:
- list_recent_emails / get_email — read mail (summarize; don't dump raw JSON)
- draft_email_reply — draft only; show the user and get explicit confirmation before send_email
- send_email — only after the user confirms to, subject, and body
- list_calendar_events — upcoming interviews and meetings
- update_job_stage — pipeline updates when the user agrees
- open_app_page — navigate when they need a full UI (resume editor, opportunities)

If inbox is not connected, tell them to connect at /inbox. Never send email without explicit user confirmation.
Always include a helpful text reply — never finish on tool calls alone.`;

const TEXT_REPLY_RULE =
  "\nAlways reply with clear, helpful text the user can read. Do not respond with only tool calls or empty output.";

export async function POST(request: Request) {
  if (!isKimchiAiConfigured()) {
    return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503 });
  }

  const auth = await getAuthedUserForAi();
  if ("error" in auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: auth.error.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser, "SCOUT");
  if (quotaError) {
    const body = await quotaError.json();
    return new Response(JSON.stringify(body), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { messages, pipeline, focusedJob } = body as {
    messages: { role: "user" | "assistant"; content: string }[];
    pipeline?: { company: string; role: string; stage: string }[];
    focusedJob?: { company: string; role: string; description?: string; intent?: string } | null;
  };

  const cleanMessages = messages
    .filter((m) => m.content?.trim())
    .map((m) => ({ role: m.role, content: m.content.trim() }));

  const resumeText = dbUser.profile?.resumeText || "";

  const primaryResume = await prisma.userAsset.findFirst({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
    select: { name: true },
  });

  const pipelineContext = pipeline?.length
    ? `\nUser's current job pipeline:\n${pipeline.map((j) => `- ${j.role} at ${j.company} (${j.stage})`).join("\n")}`
    : "\nUser has no jobs in their pipeline yet.";

  const jobPostingContext =
    focusedJob?.description?.trim()
      ? `\n\nJob posting:\n${focusedJob.description.trim().slice(0, 6000)}`
      : "";

  const focusContext = focusedJob
    ? `\nThe user is currently looking at: ${focusedJob.role} at ${focusedJob.company}.${
        focusedJob.intent === "fit"
          ? " They want to understand how well they fit this role — analyze strengths, gaps, and give honest, tactical advice."
          : ""
      }${jobPostingContext}`
    : "";

  const resumeContext = resumeText
    ? `\n\nUser's master resume${primaryResume ? ` ("${primaryResume.name}")` : ""}:\n${resumeText.slice(0, 6000)}`
    : "";

  const assistantCtx = await buildAssistantContext({ user: dbUser });
  const strategyContext = `\n\n${formatAssistantContextForPrompt(assistantCtx)}`;

  const template = await getPrompt("CHAT_SYSTEM");
  const useTools = wantsMailTools(cleanMessages);
  const systemPrompt = `${interpolate(template, {
    pipelineContext,
    focusContext,
    resumeContext: `${resumeContext}${strategyContext}`,
  })}${useTools ? MAIL_TOOL_GUIDE : TEXT_REPLY_RULE}`;

  const streamParams = {
    tier: "talk" as const,
    system: systemPrompt,
    messages: cleanMessages,
    maxOutputTokens: 1536,
    userId: dbUser.id,
    tags: ["feature:scout-chat"],
    onUsage: (usage: { inputTokens: number; outputTokens: number }, modelId: string) => {
      logAiUsage(dbUser.id, "CHAT", modelId, usage.inputTokens, usage.outputTokens);
    },
  };

  if (useTools) {
    return kimchiStreamTextWithTools({
      ...streamParams,
      tools: buildKimchiMailTools(dbUser.id),
      maxSteps: 6,
    });
  }

  return kimchiStreamText(streamParams);
}

import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-usage";
import { isKimchiAiConfigured, kimchiStreamText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";

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

  const resumeText = dbUser.profile?.resumeText || "";

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
    ? `\n\nUser's resume:\n${resumeText.slice(0, 6000)}`
    : "";

  const template = await getPrompt("CHAT_SYSTEM");
  const systemPrompt = interpolate(template, { pipelineContext, focusContext, resumeContext });

  return kimchiStreamText({
    tier: "talk",
    system: systemPrompt,
    messages,
    maxOutputTokens: 1024,
    userId: dbUser.id,
    tags: ["feature:scout-chat"],
    onUsage: (usage, modelId) => {
      logAiUsage(dbUser.id, "CHAT", modelId, usage.inputTokens, usage.outputTokens);
    },
  });
}

import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt, interpolate } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
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

  const quotaError = await requireAiQuota(dbUser);
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

  const CHAT_MODEL = "claude-sonnet-4-6";
  const stream = await getAnthropic().messages.stream({
    model: CHAT_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const userId = dbUser?.id;
  if (userId) {
    stream.on("finalMessage", (msg) => {
      logAiUsage(userId, "CHAT", CHAT_MODEL, msg.usage.input_tokens, msg.usage.output_tokens);
    });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

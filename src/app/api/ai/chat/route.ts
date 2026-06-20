import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const body = await request.json();
  const { messages, pipeline, focusedJob } = body as {
    messages: { role: "user" | "assistant"; content: string }[];
    pipeline?: { company: string; role: string; stage: string }[];
    focusedJob?: { company: string; role: string } | null;
  };

  const pipelineContext = pipeline?.length
    ? `\nUser's current job pipeline:\n${pipeline.map((j) => `- ${j.role} at ${j.company} (${j.stage})`).join("\n")}`
    : "\nUser has no jobs in their pipeline yet.";

  const focusContext = focusedJob
    ? `\nThe user is currently looking at: ${focusedJob.role} at ${focusedJob.company}.`
    : "";

  const systemPrompt = `You are Scout, an AI job search coach built into Searchly — a job search workspace for senior professionals targeting roles in Product Management, Corporate Strategy, and Operations.

Your job is to help the user land their next role. You're direct, practical, and honest — not a cheerleader. You give specific, actionable advice. You know how hiring actually works at senior levels.

You know about the user's job search:${pipelineContext}${focusContext}

When discussing specific jobs, reference what you know about them. When asked about strategy, tailor it to where they are in their search. Keep responses concise — 2-4 short paragraphs max unless they ask for something longer. No corporate fluff.`;

  const stream = await getAnthropic().messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

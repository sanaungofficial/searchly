import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt, interpolate } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { email: user.email! }, select: { id: true } });

  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  let pageText = "";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch page (${res.status}). Try pasting the job details manually.` }, { status: 422 });
    }

    const html = await res.text();
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timeout") || message.includes("abort")) {
      return NextResponse.json({ error: "Page took too long to load. Try a different URL." }, { status: 422 });
    }
    return NextResponse.json({ error: "Could not reach that URL. It may require login." }, { status: 422 });
  }

  if (!pageText || pageText.length < 100) {
    return NextResponse.json({ error: "Page content too short — may require login (LinkedIn, Workday)." }, { status: 422 });
  }

  const template = await getPrompt("JOB_PARSE");
  const promptContent = interpolate(template, { url, pageText });

  const PARSE_MODEL = "claude-haiku-4-5-20251001";
  const message = await getAnthropic().messages.create({
    model: PARSE_MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: promptContent }],
  });

  if (dbUser) logAiUsage(dbUser.id, "JOB_PARSE", PARSE_MODEL, message.usage.input_tokens, message.usage.output_tokens);

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Could not parse job details. Try adding manually." }, { status: 422 });
  }
}

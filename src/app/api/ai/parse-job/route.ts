import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { isPro } from "@/lib/stripe";
import { checkAndIncrementUsage } from "@/lib/usage";
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

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { subscription: true },
  });

  const { allowed, used, limit } = await checkAndIncrementUsage(
    dbUser?.id ?? user.id,
    isPro(dbUser?.subscription ?? null)
  );

  if (!allowed) {
    return NextResponse.json({ error: "Monthly AI limit reached", used, limit }, { status: 402 });
  }

  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  // Fetch the job page
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

    // Strip HTML tags and collapse whitespace — keep it lean for the model
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

  // Extract structured job data with Claude
  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Extract job posting details from this page content. Return ONLY valid JSON, no other text.

Page URL: ${url}
Page content: ${pageText}

Return this exact JSON shape:
{
  "company": "company name or null",
  "role": "job title or null",
  "location": "city/remote or null",
  "salary": "salary range as string or null",
  "description": "2-3 sentence summary of the role and what the company does",
  "requirements": ["key requirement 1", "key requirement 2", "key requirement 3", "key requirement 4", "key requirement 5"]
}

If you cannot determine a field, use null. Requirements should be the 4-5 most important ones, concise.`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    // Extract JSON from the response (Claude sometimes adds commentary)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Could not parse job details. Try adding manually." }, { status: 422 });
  }
}

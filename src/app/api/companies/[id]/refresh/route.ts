import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getPrompt, interpolate } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

async function getDbUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({ where: { email: user.email! } });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const company = await prisma.trackedCompany.findFirst({ where: { id, userId: dbUser.id } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const careersUrl = company.careersUrl || (company.website ? company.website.replace(/\/$/, "") + "/careers" : null);
  if (!careersUrl) {
    return NextResponse.json({ error: "Add a Careers URL or website to scan for jobs." }, { status: 422 });
  }

  let pageText = "";
  try {
    const res = await fetch(careersUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Careers page returned ${res.status}. Try adding a direct careers URL.` },
        { status: 422 }
      );
    }

    const html = await res.text();
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("timeout") || msg.includes("abort")) {
      return NextResponse.json({ error: "Careers page took too long to load." }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Could not fetch careers page. The site may require login or block bots." },
      { status: 422 }
    );
  }

  if (!pageText || pageText.length < 50) {
    return NextResponse.json(
      { error: "Careers page content was empty — may require JavaScript or login." },
      { status: 422 }
    );
  }

  const template = await getPrompt("COMPANY_JOBS_SCAN");
  const prompt = interpolate(template, { careersUrl, pageText });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: { jobs: object[]; scanned_url: string };
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.jobs)) parsed.jobs = [];
  } catch {
    return NextResponse.json({ error: "Could not parse jobs from the page. Try a more direct careers URL." }, { status: 422 });
  }

  const updated = await prisma.trackedCompany.update({
    where: { id },
    data: {
      jobsCache: parsed,
      lastJobsFetchedAt: new Date(),
      ...(company.careersUrl === null && { careersUrl }),
    },
  });

  return NextResponse.json(updated);
}

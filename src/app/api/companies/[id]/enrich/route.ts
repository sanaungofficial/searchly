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

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

  // Check shared intel cache
  const existing = await prisma.companyIntel.findUnique({ where: { name: company.name } });
  if (existing?.enrichmentCache && existing.enrichmentFetchedAt) {
    const age = Date.now() - existing.enrichmentFetchedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({
        ...company,
        enrichmentCache: existing.enrichmentCache,
        enrichmentFetchedAt: existing.enrichmentFetchedAt,
      });
    }
  }

  // Call Claude with editable prompt
  const template = await getPrompt("COMPANY_ENRICH");
  const prompt = interpolate(template, { companyName: company.name });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: object;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Could not parse company data." }, { status: 422 });
  }

  const now = new Date();
  const intel = await prisma.companyIntel.upsert({
    where: { name: company.name },
    create: { name: company.name, enrichmentCache: parsed, enrichmentFetchedAt: now },
    update: { enrichmentCache: parsed, enrichmentFetchedAt: now },
  });

  return NextResponse.json({
    ...company,
    enrichmentCache: intel.enrichmentCache,
    enrichmentFetchedAt: intel.enrichmentFetchedAt,
  });
}

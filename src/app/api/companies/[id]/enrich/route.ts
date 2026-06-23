import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
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

  const prompt = `You are a business intelligence tool. Provide factual information about the company "${company.name}".

Return ONLY a valid JSON object with this exact structure (use null for unknown fields):
{
  "description": "2-3 sentence overview of what the company does",
  "founded": "year as string, e.g. '1977'",
  "headquarters": "City, State/Country",
  "employeeCount": "range or number as string, e.g. '10,000-50,000' or 'Unknown'",
  "industry": "primary industry/sector",
  "fundingStage": "e.g. 'Public (NYSE: ORCL)', 'Series C', 'Private', 'Acquired by [Company]'",
  "totalFunding": "e.g. '$500M' or 'Public' or 'Unknown'",
  "keyInvestors": ["investor1", "investor2"],
  "leadership": [
    {"name": "Full Name", "title": "Title"}
  ],
  "recentNews": [
    {"title": "News headline", "date": "YYYY or YYYY-MM", "summary": "1 sentence summary"}
  ],
  "glassdoorRating": "rating as string e.g. '4.1' or null if unknown",
  "websiteUrl": "official website URL or null"
}

Rules:
- leadership: include CEO and up to 4 other key executives
- recentNews: up to 3 notable recent events or announcements (from your training data)
- Only include information you are confident about — use null rather than guessing
- Do not include any text outside the JSON object`;

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

  const updated = await prisma.trackedCompany.update({
    where: { id },
    data: {
      enrichmentCache: parsed,
      enrichmentFetchedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}

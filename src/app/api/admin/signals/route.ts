import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SIGNALS_PROMPT = `You are a market intelligence analyst for Kimchi, a career platform helping senior professionals (PM, Strategy, Ops, Director+) find their next role.

Generate fresh weekly market signals in this exact JSON format. Be data-informed, specific, and actionable. Use real company names where applicable.

Return ONLY valid JSON, no markdown:

{
  "headline": "One sentence market insight personalized for senior PM/Strategy/Ops professionals. Be specific about a trend this week.",
  "signals": [
    {
      "type": "hiring_surge",
      "company": "CompanyName or null",
      "title": "Short punchy title (max 12 words)",
      "body": "2-3 sentence explanation with specifics",
      "sentiment": "positive",
      "actionable": "One concrete thing the reader should do this week"
    }
  ],
  "salaryBenchmark": {
    "role": "Director / Head of Product",
    "note": "One sentence on current comp range and what's driving it"
  },
  "hotSkills": ["skill1", "skill2", "skill3", "skill4"],
  "coldSkills": ["skill1", "skill2"]
}

Include exactly 5 signals covering: 1 hiring surge, 1 trend, 1 role_demand, 1 funding, 1 salary.
Types must be one of: hiring_surge, hiring_freeze, trend, role_demand, funding, salary.
Sentiment must be one of: positive, negative, neutral.`;

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: SIGNALS_PROMPT }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const data = JSON.parse(text);

    const record = await prisma.marketSignals.create({
      data: {
        data,
        generatedBy: admin.email,
      },
    });

    return NextResponse.json({ ok: true, id: record.id, generatedAt: record.generatedAt });
  } catch (err) {
    console.error("signals refresh error", err);
    return NextResponse.json({ error: "Failed to generate signals" }, { status: 500 });
  }
}

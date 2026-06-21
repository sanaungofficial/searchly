import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function GET(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  if (!role) return NextResponse.json({ error: "role required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });

  const resumeText = dbUser?.profile?.resumeText;
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  const prompt = `You are a career coach analyzing a resume against a specific target role.

TARGET ROLE: ${role}

RESUME:
${resumeText.slice(0, 6000)}

Analyze this person's fit for the target role. Be specific to what's actually in their resume — do not be generic.

Return a JSON object with exactly these fields:

{
  "fitScore": <integer 0-100, honest assessment based on their actual background>,
  "summary": "<1 sentence in second person describing their fit, specific to their actual experience, under 25 words>",
  "gaps": [
    { "skill": "<specific gap>", "why": "<1 sentence explaining why this matters for the target role>" },
    { "skill": "<specific gap>", "why": "<1 sentence>" },
    { "skill": "<specific gap>", "why": "<1 sentence>" }
  ],
  "nextSteps": [
    "<concrete action they can take this week>",
    "<concrete action they can take this month>"
  ]
}

Scoring guide:
- 70-100: Strong foundation, likely to land interviews
- 50-69: Good fit with identifiable gaps to close
- 0-49: Significant gaps, needs a longer transition plan

Rules:
- gaps: exactly 3, the most impactful ones for THIS specific role given THEIR background
- nextSteps: actionable and specific, not generic career advice like "network more"
- summary: must be specific to their actual resume, not a generic statement
- Respond with only valid JSON, no explanation`;

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

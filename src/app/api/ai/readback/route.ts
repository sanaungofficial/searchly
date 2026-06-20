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

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true, subscription: true },
  });

  const { allowed, used, limit } = await checkAndIncrementUsage(
    dbUser?.id ?? user.id,
    isPro(dbUser?.subscription ?? null)
  );

  if (!allowed) {
    return NextResponse.json({ error: "Monthly AI limit reached", used, limit }, { status: 402 });
  }

  const resumeText = dbUser?.profile?.resumeText;
  if (!resumeText) {
    return NextResponse.json({ error: "No resume found" }, { status: 404 });
  }

  const prompt = `You are analyzing a resume to generate a brief, honest profile summary for a job search tool.

RESUME:
${resumeText.slice(0, 6000)}

Generate a profile read-back with these exact fields:

1. "picture" — A 1-2 sentence summary of who this person is professionally. Use second-person ("You're a..."). Be specific to what's actually in their resume — mention their actual function, years of experience if evident, and 1-2 distinctive traits. Keep it under 40 words. Be direct, not flattering.

2. "strengths" — Exactly 3-4 skill/strength tags extracted from their actual experience. Short noun phrases (2-4 words each). These should be skills a recruiter would notice from this specific resume.

3. "targetRoles" — Exactly 3 realistic roles this person could plausibly land based on their background. Be specific (e.g. "Director of Strategy" not just "Manager"). For each role include a fit level: "Strong match", "Good fit", or "Worth exploring".

4. "honestNote" — 1-2 sentences about a genuine gap or weakness in their profile that they should address. Be honest, not harsh. Focus on something actionable.

Respond in this exact JSON format:
{
  "picture": "You're a...",
  "strengths": ["Skill One", "Skill Two", "Skill Three"],
  "targetRoles": [
    { "role": "Role Title", "fit": "Strong match" },
    { "role": "Role Title", "fit": "Good fit" },
    { "role": "Role Title", "fit": "Worth exploring" }
  ],
  "honestNote": "..."
}`;

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
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

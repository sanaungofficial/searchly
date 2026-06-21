import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

let _a: Anthropic | null = null;
function getAnthropic() {
  if (!_a) _a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _a;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

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

  const body = await req.json();
  const { jobTitle, company, description } = body as {
    jobTitle?: string;
    company?: string;
    description?: string;
  };

  if (!description) {
    return NextResponse.json({ error: "No job description provided" }, { status: 400 });
  }

  const candidateName = dbUser?.profile?.fullName || dbUser?.name || "the candidate";

  const prompt = `You are a professional cover letter writer. Write a compelling, personalized cover letter for this candidate.

JOB:
Title: ${jobTitle || "Unknown"}
Company: ${company || "Unknown"}
Description:
${description.slice(0, 3000)}

CANDIDATE RESUME:
${resumeText.slice(0, 3000)}

Write a 3-paragraph cover letter that:
1. Opens with a specific hook referencing something real about the company or role (not generic)
2. Highlights 2-3 concrete achievements from the resume most relevant to this role with specific metrics where available
3. Closes with genuine enthusiasm and a clear call to action

Rules:
- Do NOT use the phrase "I am writing to express my interest"
- Do NOT use "I am excited about this opportunity" or similar filler
- Do NOT use em dashes
- Write in first person as ${candidateName}
- Keep it under 300 words
- Professional but not stiff — conversational and direct
- No salutation (Dear Hiring Manager) or sign-off — just the body paragraphs

Return ONLY the cover letter text, no JSON, no labels, no extra commentary.`;

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  return NextResponse.json({ letter: content.text.trim() });
}

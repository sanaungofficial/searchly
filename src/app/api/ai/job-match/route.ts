import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { getPrompt, interpolate } from "@/lib/prompts";
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
  const { jobId, jobTitle: bodyTitle, company: bodyCompany, description: bodyDesc } = body as {
    jobId?: string;
    jobTitle?: string;
    company?: string;
    description?: string;
  };

  let finalTitle = bodyTitle ?? "";
  let finalCompany = bodyCompany ?? "";
  let finalDescription = bodyDesc ?? "";

  // If jobId provided, pull job data from DB — allows re-analysis without re-passing description
  if (jobId && dbUser) {
    const job = await prisma.job.findFirst({ where: { id: jobId, userId: dbUser.id } });
    if (job) {
      finalTitle = job.role;
      finalCompany = job.company;
      const parts: string[] = [];
      if (job.description) parts.push(job.description);
      if (job.requirements.length) parts.push(`\nKey Requirements:\n${job.requirements.join("\n")}`);
      finalDescription = parts.join("") || (bodyDesc ?? "");
    }
  }

  if (!finalDescription) {
    return NextResponse.json({ error: "No job description provided" }, { status: 400 });
  }

  const template = await getPrompt("JOB_MATCH");
  const prompt = interpolate(template, {
    jobTitle: finalTitle || "Unknown",
    company: finalCompany || "Unknown",
    description: finalDescription.slice(0, 4000),
    resumeSlice: resumeText.slice(0, 4000),
  });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);

    // Persist fit score + full match data back to the job record
    if (jobId && dbUser) {
      await prisma.job.updateMany({
        where: { id: jobId, userId: dbUser.id },
        data: {
          fitScore: typeof result.score === "number" ? result.score : null,
          matchData: result,
        },
      });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 });
  }
}

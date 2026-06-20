import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";

let _a: Anthropic | null = null;
function getAnthropic() {
  if (!_a) _a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _a;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const existing = await prisma.tailoredResume.findUnique({ where: { jobId } });
  if (existing) return NextResponse.json({ sections: existing.sections });

  const [job, profile] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.profile.findFirst({ where: { user: { email: user.email! } } }),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const resumeText = profile?.resumeText || "";

  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `You are a professional resume writer. Parse and tailor this resume for the given job.

JOB:
Company: ${job.company || ""}
Role: ${job.role || ""}
Notes: ${job.notes || ""}

BASE RESUME TEXT:
${resumeText || "(no resume provided)"}

Return a JSON array of resume sections. Each section:
{ "id": "unique-id", "title": "Section Title", "type": "text"|"bullets"|"header", "content": "content string" }

For "bullets" type, content is newline-separated bullet points (no dashes).
For "header" type, content is the person's name/contact info.
For "text" type, content is a paragraph.

Include sections: Personal Info (header), Professional Summary (text), Experience (bullets), Education (text), Skills (bullets).
Tailor the Professional Summary and highlight relevant Experience to match the job role and company.

Return ONLY the JSON array, no other text.`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  let sections: Record<string, unknown>[] = [];
  try {
    sections = JSON.parse(text.trim());
  } catch {
    sections = [{ id: "1", title: "Resume", type: "text", content: resumeText }];
  }

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.tailoredResume.create({
    data: { jobId, userId: dbUser.id, sections: sections as Prisma.InputJsonValue },
  });

  return NextResponse.json({ sections });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const { sections } = await req.json();

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.tailoredResume.upsert({
    where: { jobId },
    create: { jobId, userId: dbUser.id, sections },
    update: { sections },
  });

  return NextResponse.json({ success: true });
}

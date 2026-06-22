import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getPrompt, interpolate } from "@/lib/prompts";
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

  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.tailoredResume.findFirst({ where: { jobId, userId: dbUser.id } });
  if (existing) return NextResponse.json({ sections: existing.sections });

  const [job, profile] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId } }),
    prisma.profile.findFirst({ where: { user: { email: user.email! } } }),
  ]);

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const resumeText = profile?.resumeText || "";

  const template = await getPrompt("RESUME_TAILOR");
  const promptContent = interpolate(template, {
    company: job.company || "",
    role: job.role || "",
    jobNotes: job.notes || "",
    resumeText: resumeText || "(no resume provided)",
  });

  const message = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: promptContent }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  let sections: Record<string, unknown>[] = [];
  try {
    sections = JSON.parse(text.trim());
  } catch {
    sections = [{ id: "1", title: "Resume", type: "text", content: resumeText }];
  }

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

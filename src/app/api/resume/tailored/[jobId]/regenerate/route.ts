import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

let _a: Anthropic | null = null;
function getAnthropic() {
  if (!_a) _a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _a;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

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
      content: `Rewrite and tailor this resume for the job below. Be more aggressive in aligning the language and priorities to the job requirements.

JOB:
Company: ${job.company || ""}
Role: ${job.role || ""}
Notes: ${job.notes || ""}

BASE RESUME:
${resumeText || "(no resume provided)"}

Return a JSON array of resume sections. Each section:
{ "id": "unique-id", "title": "Section Title", "type": "text"|"bullets"|"header", "content": "content string" }

For "bullets" type, content is newline-separated bullet points.
For "header" type, content is the person's name/contact info.
For "text" type, content is a paragraph.

Return ONLY the JSON array, no other text.`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  let sections: unknown[] = [];
  try {
    sections = JSON.parse(text.trim());
  } catch {
    sections = [{ id: "1", title: "Resume", type: "text", content: resumeText }];
  }

  return NextResponse.json({ sections });
}

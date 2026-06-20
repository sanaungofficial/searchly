import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

async function getDbUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const dbUser = await getDbUser(supabase);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { tool, company, role, notes, jobId } = body as {
    tool: "resume" | "cover" | "fit";
    company: string;
    role: string;
    notes?: string;
    jobId?: string;
  };

  if (!tool || !company || !role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch job notes from DB if jobId provided and notes not passed
  let jobNotes = notes || "";
  if (jobId && !notes) {
    const job = await prisma.job.findFirst({
      where: { id: jobId, userId: dbUser.id },
    });
    jobNotes = job?.notes || "";
  }

  const userName = dbUser.name || "the candidate";
  const resumeText = dbUser.profile?.resumeText || "";
  const profileContext = [
    resumeText ? `RESUME:\n${resumeText}` : "",
    dbUser.profile?.linkedinUrl ? `LinkedIn: ${dbUser.profile.linkedinUrl}` : "",
    dbUser.profile?.headline ? `Headline: ${dbUser.profile.headline}` : "",
    dbUser.profile?.targetRoles?.length ? `Target roles: ${dbUser.profile.targetRoles.join(", ")}` : "",
  ].filter(Boolean).join("\n\n");

  let prompt = "";

  if (tool === "resume") {
    prompt = `You are a professional resume writer helping ${userName} tailor their resume for a job at ${company} as ${role}.

${profileContext}
${jobNotes ? `\nJob notes/description: ${jobNotes}` : ""}

${resumeText ? "Using the candidate's actual resume above, generate" : "Generate"} 4 strong, tailored resume bullet points for this role. Each bullet should:
- Start with a strong action verb
- Include specific metrics or impact where possible
- Be relevant to what ${company} likely looks for in a ${role}
- Be 1-2 sentences max

Also generate a short 1-sentence resume summary line tailored to ${company}.

Respond in this exact JSON format:
{
  "bullets": [
    { "tailored": "bullet text", "hint": "why this matters for this role" },
    { "tailored": "bullet text", "hint": "why this matters for this role" },
    { "tailored": "bullet text", "hint": "why this matters for this role" },
    { "tailored": "bullet text", "hint": "why this matters for this role" }
  ],
  "summary": "one sentence summary"
}`;
  } else if (tool === "cover") {
    prompt = `You are a professional cover letter writer helping ${userName} apply for ${role} at ${company}.

${profileContext}
${jobNotes ? `Job notes/description: ${jobNotes}` : ""}

${resumeText ? "Drawing from the candidate's actual resume above, write" : "Write"} a compelling, concise cover letter (3 short paragraphs). It should:
- Open with a specific, non-generic hook about ${company}
- Connect the candidate's background to the role
- Close with a clear call to action
- Sound like a real human wrote it, not a bot
- Be direct and confident, not sycophantic

Respond with just the cover letter text, no subject line or "Dear Hiring Manager" header — start directly with the opening paragraph.`;
  } else if (tool === "fit") {
    prompt = `You are a career strategist helping ${userName} understand their fit for ${role} at ${company}.

${profileContext}
${jobNotes ? `Job notes/description: ${jobNotes}` : ""}

${resumeText ? "Based on the candidate's actual resume above, analyze" : "Analyze"} and explain:
1. Why this person is a strong candidate for this role (2-3 specific strengths)
2. Any potential gaps or things to address in the application
3. One tactical tip for standing out

Keep it honest, direct, and actionable. No fluff. Format as:

**Why you're a strong fit:**
[2-3 bullet points]

**Potential gaps to address:**
[1-2 bullet points]

**Tactic to stand out:**
[one concrete tip]`;
  }

  const MODEL = "claude-haiku-4-5-20251001";
  const message = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const aiFeature = tool === "cover" ? "COVER_LETTER" : tool === "fit" ? "FIT_ANALYSIS" : "RESUME_BULLETS";
  logAiUsage(dbUser.id, aiFeature as import("@prisma/client").AiFeature, MODEL, message.usage.input_tokens, message.usage.output_tokens);

  const content = message.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  if (tool === "resume") {
    try {
      const parsed = JSON.parse(content.text);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }
  }

  return NextResponse.json({ text: content.text });
}

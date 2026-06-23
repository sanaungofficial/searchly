import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt } from "@/lib/prompts";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import { PARSE_MODEL, parseResumeText } from "@/lib/resume-extract";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const asset = await prisma.userAsset.findFirst({ where: { id, userId: dbUser.id, type: "RESUME" } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!asset.resumeText) return NextResponse.json({ error: "No resume text to parse" }, { status: 404 });

  const structuredPrompt = await getPrompt("RESUME_PARSE");
  const { parsed, tokensIn, tokensOut } = await parseResumeText(
    getAnthropic(),
    asset.resumeText,
    structuredPrompt,
  );

  logAiUsage(dbUser.id, "RESUME_PARSE", PARSE_MODEL, tokensIn, tokensOut);

  if (!parsed) {
    return NextResponse.json({ error: "Could not parse resume" }, { status: 422 });
  }

  const updated = await prisma.userAsset.update({
    where: { id },
    data: { parsedData: parsed },
  });

  if (updated.isPrimary) {
    await syncPrimaryResumeToProfile(dbUser.id);
  }

  return NextResponse.json({ parsedData: normalizeParsedResumeData(updated.parsedData) });
}

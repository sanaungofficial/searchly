import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt } from "@/lib/prompts";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import { hydrateResumeAsset } from "@/lib/ensure-asset-resume";
import {
  fetchResumeBytes,
  isPdfBuffer,
  PARSE_MODEL,
  parseResumePdf,
  parseResumeText,
} from "@/lib/resume-extract";
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

  const asset = await hydrateResumeAsset(id, dbUser.id);
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const structuredPrompt = await getPrompt("RESUME_PARSE");
  let resumeText = asset.resumeText?.trim() || "";
  let parsed = null;
  let tokensIn = 0;
  let tokensOut = 0;

  if (resumeText) {
    ({ parsed, tokensIn, tokensOut } = await parseResumeText(getAnthropic(), resumeText, structuredPrompt));
  } else if (asset.url) {
    const bytes = await fetchResumeBytes(asset.url);
    if (bytes && isPdfBuffer(bytes)) {
      const result = await parseResumePdf(getAnthropic(), bytes.toString("base64"), structuredPrompt);
      resumeText = result.text;
      parsed = result.parsed;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
    }
  }

  if (!resumeText && !parsed) {
    return NextResponse.json({ error: "No resume text or PDF to parse" }, { status: 404 });
  }

  logAiUsage(dbUser.id, "RESUME_PARSE", PARSE_MODEL, tokensIn, tokensOut);

  if (!parsed) {
    return NextResponse.json({ error: "Could not parse resume" }, { status: 422 });
  }

  const updated = await prisma.userAsset.update({
    where: { id },
    data: {
      parsedData: parsed,
      ...(resumeText ? { resumeText } : {}),
    },
  });

  if (updated.isPrimary) {
    await syncPrimaryResumeToProfile(dbUser.id);
  }

  return NextResponse.json({ parsedData: normalizeParsedResumeData(updated.parsedData) });
}

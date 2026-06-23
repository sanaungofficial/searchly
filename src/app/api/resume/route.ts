import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt } from "@/lib/prompts";
import {
  mergeParsedWithReadback,
  normalizeParsedResumeData,
  shouldReplaceNameWithResumeName,
  type ParsedResumeData,
} from "@/lib/resume-parse";
import { PARSE_MODEL, parseResumePdf, parseResumeText } from "@/lib/resume-extract";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

async function extractResume(file: File, structuredPrompt: string): Promise<{ text: string; parsed: ParsedResumeData | null; tokensIn: number; tokensOut: number }> {
  const bytes = await file.arrayBuffer();
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const base64 = Buffer.from(bytes).toString("base64");
    return parseResumePdf(getAnthropic(), base64, structuredPrompt);
  }

  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const { value: rawText } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      if (!rawText.trim()) return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
      const { parsed, tokensIn, tokensOut } = await parseResumeText(getAnthropic(), rawText, structuredPrompt);
      return { text: rawText, parsed, tokensIn, tokensOut };
    } catch {
      return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
    }
  }

  if (ext === "txt") {
    const rawText = Buffer.from(bytes).toString("utf-8");
    const { parsed, tokensIn, tokensOut } = await parseResumeText(getAnthropic(), rawText, structuredPrompt);
    return { text: rawText, parsed, tokensIn, tokensOut };
  }

  return { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop();
  const path = `${user.id}/resume-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, file, { upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: signedData, error: signedError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  if (signedError || !signedData) {
    return NextResponse.json({ error: "Could not generate file URL" }, { status: 500 });
  }

  const publicUrl = signedData.signedUrl;

  const structuredPrompt = process.env.ANTHROPIC_API_KEY ? await getPrompt("RESUME_PARSE") : "";

  const { text: resumeText, parsed: parsedRaw, tokensIn: rTokIn, tokensOut: rTokOut } = process.env.ANTHROPIC_API_KEY
    ? await extractResume(file, structuredPrompt)
    : { text: "", parsed: null, tokensIn: 0, tokensOut: 0 };

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email!.split("@")[0];

  const dbUser = await prisma.user.upsert({
    where: { email: user.email! },
    update: {},
    create: { email: user.email!, name },
  });

  if (resumeText) logAiUsage(dbUser.id, "RESUME_PARSE", PARSE_MODEL, rTokIn, rTokOut);

  const parsedData = parsedRaw;

  const extractedName = parsedData?.name;
  const metadataName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined);
  if (
    extractedName &&
    shouldReplaceNameWithResumeName(dbUser.name, user.email!, metadataName)
  ) {
    await prisma.user.update({ where: { id: dbUser.id }, data: { name: extractedName } });
  }

  await prisma.profile.upsert({
    where: { userId: dbUser.id },
    update: {
      resumeUrl: publicUrl,
      ...(resumeText ? { resumeText } : {}),
      ...(parsedData ? { parsedData } : {}),
    },
    create: {
      userId: dbUser.id,
      resumeUrl: publicUrl,
      resumeText: resumeText || undefined,
      parsedData: parsedData ?? undefined,
      targetRoles: [],
      priorities: [],
    },
  });

  await prisma.userAsset.updateMany({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
    data: { isPrimary: false },
  });

  const asset = await prisma.userAsset.create({
    data: {
      userId: dbUser.id,
      type: "RESUME",
      name: file.name.replace(/\.[^/.]+$/, "") || "Resume",
      url: publicUrl,
      isPrimary: true,
    },
  });

  return NextResponse.json({
    url: publicUrl,
    parsed: !!parsedData,
    parsedData,
    asset,
  });
}

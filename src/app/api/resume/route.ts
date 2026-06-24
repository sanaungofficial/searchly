import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt } from "@/lib/prompts";
import { syncPrimaryResumeToProfile } from "@/lib/sync-primary-resume";
import { shouldReplaceNameWithResumeName } from "@/lib/resume-parse";
import { PARSE_MODEL, parseResumeFile } from "@/lib/resume-extract";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["pdf", "docx", "txt"].includes(ext)) {
    return NextResponse.json({ error: "Upload a PDF, DOCX, or TXT resume" }, { status: 400 });
  }

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
  const bytes = Buffer.from(await file.arrayBuffer());
  const anthropic = process.env.ANTHROPIC_API_KEY ? getAnthropic() : null;
  const structuredPrompt = anthropic ? await getPrompt("RESUME_PARSE") : "";

  const { text: resumeText, parsed: parsedRaw, tokensIn, tokensOut, usedFallback, provider } = await parseResumeFile(
    anthropic,
    bytes,
    ext,
    structuredPrompt,
    file.name,
  );

  if (!resumeText) {
    return NextResponse.json({ error: "Could not read text from this file. Try PDF, DOCX, or TXT." }, { status: 422 });
  }

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email!.split("@")[0];

  const dbUser = await prisma.user.upsert({
    where: { email: user.email! },
    update: {},
    create: { email: user.email!, name },
  });

  if (tokensIn > 0) {
    logAiUsage(dbUser.id, "RESUME_PARSE", PARSE_MODEL, tokensIn, tokensOut);
  }

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
      resumeText,
      parsedData: (parsedData ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
    },
  });

  await syncPrimaryResumeToProfile(dbUser.id);

  return NextResponse.json({
    url: publicUrl,
    parsed: !!parsedData,
    parsedData,
    asset,
    _fallback: usedFallback,
    _provider: provider,
  });
}

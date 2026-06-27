import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { isKimchiAiConfigured } from "@/lib/llm";
import { getPrompt } from "@/lib/prompts";
import {
  isLikelyBrokenWorkExperience,
  mergeParsedWithReadback,
  normalizeParsedResumeData,
  shouldReplaceNameWithResumeName,
} from "@/lib/resume-parse";
import { parseResumeText } from "@/lib/resume-extract";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST() {
  if (!isKimchiAiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });
  if (!dbUser?.profile?.resumeText) {
    return NextResponse.json({ error: "No resume text to parse" }, { status: 404 });
  }

  const existing = normalizeParsedResumeData(dbUser.profile.parsedData);
  const hasStructure =
    (existing?.education.length ?? 0) > 0 ||
    (existing?.workExperience.length ?? 0) > 0;
  const structureLooksBroken = isLikelyBrokenWorkExperience(existing?.workExperience ?? []);
  if (hasStructure && !structureLooksBroken) {
    const parsedData = mergeParsedWithReadback(existing, dbUser.profile.readbackData);
    return NextResponse.json({ parsedData, skipped: true });
  }

  const structuredPrompt = await getPrompt("RESUME_PARSE");
  const { parsed, tokensIn, tokensOut, modelId } = await parseResumeText(
    dbUser.profile.resumeText,
    structuredPrompt,
    dbUser.id,
  );

  logAiUsage(dbUser.id, "RESUME_PARSE", modelId, tokensIn, tokensOut);

  const parsedData = mergeParsedWithReadback(parsed, dbUser.profile.readbackData);
  if (!parsed) {
    return NextResponse.json({ error: "Could not parse resume" }, { status: 422 });
  }

  const extractedName = parsedData.name;
  const metadataName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined);
  if (
    extractedName &&
    shouldReplaceNameWithResumeName(dbUser.name, user.email!, metadataName)
  ) {
    await prisma.user.update({ where: { id: dbUser.id }, data: { name: extractedName } });
  }

  await prisma.profile.update({
    where: { id: dbUser.profile.id },
    data: { parsedData: parsedData as unknown as Prisma.InputJsonValue },
  });

  const updatedUser = await prisma.user.findUnique({ where: { id: dbUser.id } });

  return NextResponse.json({
    parsedData,
    name: updatedUser?.name ?? dbUser.name,
  });
}

import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  buildLinkedInDraftHeuristic,
  normalizeLinkedInDraft,
  parseLinkedInDraftFromModel,
} from "@/lib/linkedin-profile";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const MODEL = "claude-haiku-4-5-20251001";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const primary = await prisma.userAsset.findFirst({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
  });

  const resume =
    normalizeParsedResumeData(primary?.parsedData ?? dbUser.profile?.parsedData ?? null);

  if (!resume || (!resume.workExperience.length && !resume.summary && !resume.skills.length)) {
    return NextResponse.json(
      { error: "Upload and parse a resume first — Kimchi needs structured experience to build your LinkedIn preview." },
      { status: 422 },
    );
  }

  const name = dbUser.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "You";
  const targetRoles = dbUser.profile?.targetRoles ?? [];
  const sourceAssetId = primary?.id ?? null;
  const existingDraft = normalizeLinkedInDraft(dbUser.profile?.linkedInDraft ?? null);

  let draft = null as ReturnType<typeof normalizeLinkedInDraft>;
  let provider: "claude" | "heuristic" = "heuristic";

  const anthropic = process.env.ANTHROPIC_API_KEY ? getAnthropic() : null;
  if (anthropic) {
    try {
      const template = await getPrompt("LINKEDIN_DRAFT");
      const prompt = interpolate(template, {
        name,
        targetRoles: targetRoles.length ? targetRoles.join(", ") : "Not specified",
        resumeJson: JSON.stringify(resume).slice(0, 12000),
      });

      const message = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content[0]?.type === "text" ? message.content[0].text : "";
      draft = parseLinkedInDraftFromModel(text);
      if (draft) {
        provider = "claude";
        logAiUsage(dbUser.id, "FIT_ANALYSIS", MODEL, message.usage.input_tokens, message.usage.output_tokens);
      }
    } catch (err) {
      console.error("[linkedin-draft] AI generation failed:", err);
    }
  }

  if (!draft) {
    draft = buildLinkedInDraftHeuristic({ resume, name, targetRoles, sourceAssetId });
    provider = "heuristic";
  } else {
    draft = {
      ...draft,
      sourceAssetId,
      generatedAt: new Date().toISOString(),
    };
  }

  draft = {
    ...draft,
    profilePhotoUrl:
      existingDraft?.profilePhotoUrl ??
      dbUser.avatarUrl ??
      null,
    coverPhotoUrl: existingDraft?.coverPhotoUrl ?? null,
  };

  await prisma.profile.upsert({
    where: { userId: dbUser.id },
    update: {
      linkedInDraft: draft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
      linkedInDraftSourceAssetId: sourceAssetId,
    },
    create: {
      userId: dbUser.id,
      targetRoles: targetRoles.length ? targetRoles : [],
      priorities: [],
      linkedInDraft: draft as unknown as Prisma.InputJsonValue,
      linkedInDraftUpdatedAt: new Date(),
      linkedInDraftSourceAssetId: sourceAssetId,
    },
  });

  return NextResponse.json({
    draft,
    provider,
    sourceAssetId,
    updatedAt: new Date().toISOString(),
  });
}

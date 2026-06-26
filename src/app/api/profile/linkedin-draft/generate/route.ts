import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  normalizeLinkedInDraft,
  parseLinkedInDraftFromModel,
} from "@/lib/linkedin-profile";
import { syncLinkedInDraftFromAbout } from "@/lib/profile-linkedin-sync";
import { aboutProfileFingerprint, withAboutFingerprint } from "@/lib/linkedin-about-fingerprint";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import { loadParsedForSync } from "@/lib/profile-linkedin-sync";
import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;
  const { authUser, dbUser } = resolved;

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });

  const primary = await prisma.userAsset.findFirst({
    where: { userId: dbUser.id, type: "RESUME", isPrimary: true },
  });

  const resume =
    normalizeParsedResumeData(primary?.parsedData ?? profile?.parsedData ?? null);

  if (!resume || (!resume.workExperience.length && !resume.summary && !resume.skills.length)) {
    return NextResponse.json(
      { error: "Upload and parse a resume first — Kimchi needs structured experience to build your LinkedIn preview." },
      { status: 422 },
    );
  }

  const name = dbUser.name || authUser.email.split("@")[0] || "You";
  const targetRoles = profile?.targetRoles ?? [];
  const sourceAssetId = primary?.id ?? null;
  const existingDraft = normalizeLinkedInDraft(profile?.linkedInDraft ?? null);

  let aiDraft = null as ReturnType<typeof normalizeLinkedInDraft>;
  let provider: "claude" | "heuristic" = "heuristic";

  if (isKimchiAiConfigured()) {
    try {
      const template = await getPrompt("LINKEDIN_DRAFT");
      const prompt = interpolate(template, {
        name,
        targetRoles: targetRoles.length ? targetRoles.join(", ") : "Not specified",
        resumeJson: JSON.stringify(resume).slice(0, 12000),
      });

      const { text, usage, modelId } = await kimchiGenerateText({
        tier: "create",
        prompt,
        maxOutputTokens: 4096,
        userId: dbUser.id,
        tags: ["feature:linkedin-draft"],
      });

      aiDraft = parseLinkedInDraftFromModel(text);
      if (aiDraft) {
        provider = "claude";
        logAiUsage(dbUser.id, "FIT_ANALYSIS", modelId, usage.inputTokens, usage.outputTokens);
      }
    } catch (err) {
      console.error("[linkedin-draft] AI generation failed:", err);
    }
  }

  let draft = syncLinkedInDraftFromAbout({
    parsed: resume,
    name,
    targetRoles,
    headline: aiDraft?.headline || profile?.headline,
    summary: aiDraft?.about || profile?.summary || resume.summary,
    existingDraft,
    sourceAssetId,
  });

  if (aiDraft) {
    draft = {
      ...draft,
      headline: aiDraft.headline || draft.headline,
      about: aiDraft.about || draft.about,
      generatedAt: new Date().toISOString(),
    };
  }

  const parsed = loadParsedForSync(profile?.parsedData);
  draft = withAboutFingerprint(
    {
      ...draft,
      profilePhotoUrl:
        existingDraft?.profilePhotoUrl ??
        dbUser.avatarUrl ??
        null,
      coverPhotoUrl: existingDraft?.coverPhotoUrl ?? null,
    },
    aboutProfileFingerprint({
      parsed,
      headline: profile?.headline,
      summary: profile?.summary ?? resume.summary,
    }),
  );

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

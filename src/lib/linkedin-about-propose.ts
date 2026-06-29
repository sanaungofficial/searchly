import { prisma } from "@/lib/prisma";
import { logAiUsage } from "@/lib/ai-usage";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  normalizeLinkedInDraft,
  parseLinkedInDraftFromModel,
  type LinkedInProfileDraft,
} from "@/lib/linkedin-profile";
import { syncLinkedInDraftFromAbout } from "@/lib/profile-linkedin-sync";
import { normalizeParsedResumeData } from "@/lib/resume-parse";

export type AboutProposedDraftResult = {
  draft: LinkedInProfileDraft;
  provider: "claude" | "heuristic";
  sourceAssetId: string | null;
};

/** Build a LinkedIn draft from About/resume data without persisting. */
export async function buildProposedLinkedInDraftFromAbout(userId: string): Promise<AboutProposedDraftResult | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!dbUser) return null;

  const profile = dbUser.profile;
  const primary = await prisma.userAsset.findFirst({
    where: { userId, type: "RESUME", isPrimary: true },
  });

  const resume = normalizeParsedResumeData(primary?.parsedData ?? profile?.parsedData ?? null);
  if (!resume || (!resume.workExperience.length && !resume.summary && !resume.skills.length)) {
    return null;
  }

  const name = dbUser.name || "You";
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
        userId,
        tags: ["feature:linkedin-draft"],
      });

      aiDraft = parseLinkedInDraftFromModel(text);
      if (aiDraft) {
        provider = "claude";
        logAiUsage(userId, "FIT_ANALYSIS", modelId, usage.inputTokens, usage.outputTokens);
      }
    } catch (err) {
      console.error("[linkedin-about-propose] AI generation failed:", err);
    }
  }

  let draft = syncLinkedInDraftFromAbout({
    parsed: resume,
    name,
    targetRoles,
    headline: aiDraft?.headline || profile?.headline,
    summary: aiDraft?.about || profile?.summary || resume.summary,
    existingDraft: null,
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

  draft = {
    ...draft,
    profilePhotoUrl: existingDraft?.profilePhotoUrl ?? dbUser.avatarUrl ?? null,
    coverPhotoUrl: existingDraft?.coverPhotoUrl ?? null,
    lastLinkedInImportAt: existingDraft?.lastLinkedInImportAt ?? null,
    coachNotes: existingDraft?.coachNotes ?? null,
    sourceAssetId,
  };

  return { draft, provider, sourceAssetId };
}

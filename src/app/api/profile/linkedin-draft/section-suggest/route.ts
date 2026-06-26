import { resolveProfileApiSubject } from "@/lib/admin-client-subject";
import { prisma } from "@/lib/prisma";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  LINKEDIN_SECTION_TITLES,
  type LinkedInSectionId,
} from "@/lib/linkedin-analysis";
import { normalizeLinkedInDraft, type LinkedInProfileDraft } from "@/lib/linkedin-profile";
import { parseJsonFromModel } from "@/lib/resume-parse";
import { NextResponse } from "next/server";

function sectionSlice(
  draft: LinkedInProfileDraft,
  sectionId: LinkedInSectionId,
  entryId?: string,
  entryLabel?: string,
): string {
  switch (sectionId) {
    case "headline":
      return draft.headline;
    case "about":
      return draft.about;
    case "skills":
      return draft.skills.join(", ");
    case "education": {
      if (entryId) {
        const entry = draft.education.find((e) => e.id === entryId);
        return entry ? JSON.stringify(entry, null, 2) : JSON.stringify(draft.education, null, 2);
      }
      return JSON.stringify(draft.education, null, 2);
    }
    case "experience": {
      if (entryId) {
        const entry = draft.experience.find((e) => e.id === entryId);
        return entry ? JSON.stringify(entry, null, 2) : "";
      }
      const entry = entryLabel
        ? draft.experience.find(
            (e) =>
              e.id === entryLabel ||
              e.company === entryLabel ||
              e.title === entryLabel ||
              `${e.company} ${e.title}`.includes(entryLabel),
          )
        : draft.experience[0];
      return entry ? JSON.stringify(entry, null, 2) : JSON.stringify(draft.experience.slice(0, 2), null, 2);
    }
    default:
      return "";
  }
}

export async function POST(request: Request) {
  const resolved = await resolveProfileApiSubject(request);
  if ("error" in resolved) return resolved.error;
  const { dbUser } = resolved;

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const draft = normalizeLinkedInDraft(profile?.linkedInDraft ?? null);
  if (!draft) return NextResponse.json({ error: "No LinkedIn draft" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const sectionId = body.sectionId as LinkedInSectionId;
  if (!sectionId || !(sectionId in LINKEDIN_SECTION_TITLES)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }
  const entryId = typeof body.entryId === "string" ? body.entryId : undefined;
  const entryLabel = typeof body.entryLabel === "string" ? body.entryLabel : undefined;
  const draftSlice = sectionSlice(draft, sectionId, entryId, entryLabel);
  const targetRoles = (profile?.targetRoles as string[] | null)?.join(", ") || "your target roles";

  if (!isKimchiAiConfigured()) {
    return NextResponse.json({
      issues: [],
      suggestions: [
        {
          label: "Dev preview",
          text: draftSlice.slice(0, 500) || "Add content here — full AI suggestions available on production.",
        },
      ],
    });
  }

  try {
    const template = await getPrompt("LINKEDIN_SECTION_SUGGEST");
    const prompt = interpolate(template, {
      sectionId,
      sectionLabel: LINKEDIN_SECTION_TITLES[sectionId],
      entryLabel: entryLabel ? ` (${entryLabel})` : "",
      draftSlice: draftSlice.slice(0, 6000),
      targetRoles,
    });

    const { text } = await kimchiGenerateText({
      tier: "create",
      prompt,
      maxOutputTokens: 1500,
      userId: dbUser.id,
      tags: ["feature:linkedin-section-suggest"],
    });

    const parsed = parseJsonFromModel(text) as {
      issues?: Array<Record<string, unknown>>;
      suggestions?: Array<{ label?: string; text?: string }>;
    } | null;

    const issues = Array.isArray(parsed?.issues)
      ? parsed!.issues
          .map((row, i) => ({
            id: `${sectionId}-s-${i}`,
            severity: (typeof row.severity === "string" ? row.severity : "Optional") as "Urgent" | "Critical" | "Optional" | "Minor",
            title: typeof row.title === "string" ? row.title : "Suggestion",
            issueDetected: typeof row.issueDetected === "string" ? row.issueDetected : "",
            whyItMatters: typeof row.whyItMatters === "string" ? row.whyItMatters : "",
            howToImprove: typeof row.howToImprove === "string" ? row.howToImprove : "",
          }))
          .filter((row) => row.issueDetected || row.howToImprove)
      : [];

    const suggestions = Array.isArray(parsed?.suggestions)
      ? parsed!.suggestions
          .map((s, i) => ({
            id: `opt-${i}`,
            label: typeof s.label === "string" ? s.label : `Option ${i + 1}`,
            text: typeof s.text === "string" ? s.text : "",
          }))
          .filter((s) => s.text.trim())
      : [];

    return NextResponse.json({ issues, suggestions });
  } catch {
    return NextResponse.json({ error: "Could not generate suggestions" }, { status: 500 });
  }
}

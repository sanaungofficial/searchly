import { prisma } from "@/lib/prisma";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getOwnedAssetForActingUser } from "@/lib/owned-asset";
import { getActingUser } from "@/lib/acting-user";
import { getPrompt, interpolate } from "@/lib/prompts";
import { fallbackSectionSuggestion } from "@/lib/resume-section-fallback";
import { parseJsonFromModel, sectionTextBlob, normalizeParsedResumeData, type ResumeSectionId } from "@/lib/resume-parse";
import { NextResponse } from "next/server";

const SECTION_LABELS: Record<ResumeSectionId, string> = {
  summary: "Professional Summary",
  skills: "Areas of Emphasis",
  experience: "Work Experience",
  education: "Education & Training",
  certifications: "Certifications",
};

function experienceSlice(
  parsed: ReturnType<typeof normalizeParsedResumeData>,
  entryId?: string,
  entryLabel?: string,
): string {
  if (!parsed) return "";
  if (entryId) {
    const entry = parsed.workExperience.find((e) => e.id === entryId);
    return entry ? JSON.stringify(entry, null, 2) : "";
  }
  const entry = entryLabel
    ? parsed.workExperience.find(
        (e) =>
          e.id === entryLabel ||
          e.company === entryLabel ||
          e.title === entryLabel ||
          `${e.company} ${e.title}`.includes(entryLabel),
      )
    : parsed.workExperience[0];
  return entry ? JSON.stringify(entry, null, 2) : JSON.stringify(parsed.workExperience.slice(0, 2), null, 2);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authUser } = await getActingUser(request);
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedAssetForActingUser(id, request);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { dbUser, asset } = owned;
  const parsed = normalizeParsedResumeData(asset.parsedData);
  if (!parsed) return NextResponse.json({ error: "No resume data" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const sectionId = body.sectionId as ResumeSectionId;
  if (!sectionId || !(sectionId in SECTION_LABELS)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }
  const entryId = typeof body.entryId === "string" ? body.entryId : undefined;
  const entryLabel = typeof body.entryLabel === "string" ? body.entryLabel : undefined;

  const draftSlice =
    sectionId === "experience"
      ? experienceSlice(parsed, entryId, entryLabel)
      : sectionTextBlob(parsed, sectionId, entryId);

  const profile = await prisma.profile.findUnique({ where: { userId: dbUser.id } });
  const targetRoles = (profile?.targetRoles as string[] | null)?.join(", ") || "your target roles";
  const fallbackText = fallbackSectionSuggestion(sectionId, parsed, targetRoles);

  if (!isKimchiAiConfigured()) {
    return NextResponse.json({
      issues: [],
      suggestions: [
        {
          id: "opt-fallback",
          label: "Recommended draft",
          text: draftSlice.trim() || fallbackText || "Add content here — full AI suggestions available on production.",
        },
      ],
    });
  }

  try {
    const template = await getPrompt("RESUME_SECTION_SUGGEST");
    const prompt = interpolate(template, {
      sectionId,
      sectionLabel: SECTION_LABELS[sectionId],
      entryLabel: entryLabel ? ` (${entryLabel})` : "",
      draftSlice: draftSlice.slice(0, 6000),
      targetRoles,
    });

    const { text } = await kimchiGenerateText({
      tier: "create",
      prompt,
      maxOutputTokens: 1500,
      userId: dbUser.id,
      tags: ["feature:resume-section-suggest"],
    });

    const result = parseJsonFromModel(text) as {
      issues?: Array<Record<string, unknown>>;
      suggestions?: Array<{ label?: string; text?: string }>;
    } | null;

    const issues = Array.isArray(result?.issues)
      ? result!.issues
          .map((row, i) => ({
            id: `${sectionId}-s-${i}`,
            severity: (typeof row.severity === "string" ? row.severity : "Optional") as
              | "Urgent"
              | "Critical"
              | "Optional"
              | "Minor",
            title: typeof row.title === "string" ? row.title : "Suggestion",
            issueDetected: typeof row.issueDetected === "string" ? row.issueDetected : "",
            whyItMatters: typeof row.whyItMatters === "string" ? row.whyItMatters : "",
            howToImprove: typeof row.howToImprove === "string" ? row.howToImprove : "",
          }))
          .filter((row) => row.issueDetected || row.howToImprove)
      : [];

    let suggestions = Array.isArray(result?.suggestions)
      ? result!.suggestions
          .map((s, i) => ({
            id: `opt-${i}`,
            label: typeof s.label === "string" ? s.label : `Option ${i + 1}`,
            text: typeof s.text === "string" ? s.text : "",
          }))
          .filter((s) => s.text.trim())
      : [];

    if (!suggestions.length && fallbackText) {
      suggestions = [{ id: "opt-fallback", label: "Recommended draft", text: fallbackText }];
    }

    return NextResponse.json({ issues, suggestions });
  } catch {
    if (fallbackText) {
      return NextResponse.json({
        issues: [],
        suggestions: [{ id: "opt-fallback", label: "Recommended draft", text: fallbackText }],
      });
    }
    return NextResponse.json({ error: "Could not generate suggestions" }, { status: 500 });
  }
}

import { prisma } from "@/lib/prisma";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { parseJsonFromModel, sectionTextBlob, normalizeParsedResumeData, type ResumeSectionId } from "@/lib/resume-parse";
import { createClient } from "@/utils/supabase/server";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const asset = await prisma.userAsset.findFirst({
    where: { id, userId: dbUser.id, type: "RESUME" },
  });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const targetRoles = (dbUser.profile?.targetRoles as string[] | null)?.join(", ") || "your target roles";

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

    const suggestions = Array.isArray(result?.suggestions)
      ? result!.suggestions
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

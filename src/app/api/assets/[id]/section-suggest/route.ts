import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { parseJsonFromModel, normalizeParsedResumeData, type ParsedResumeData, type ResumeSectionId } from "@/lib/resume-parse";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const SECTION_LABELS: Record<ResumeSectionId, string> = {
  summary: "Professional Summary",
  skills: "Skills",
  experience: "Work Experience",
  education: "Education",
  certifications: "Certifications",
};

function sectionSlice(data: ParsedResumeData, sectionId: ResumeSectionId, entryLabel?: string): string {
  switch (sectionId) {
    case "summary":
      return data.summary || "";
    case "skills":
      return data.skills.join(", ");
    case "experience": {
      if (entryLabel) {
        const entry = data.workExperience.find(
          (w) =>
            w.company === entryLabel ||
            w.title === entryLabel ||
            `${w.company} ${w.title}`.includes(entryLabel),
        );
        return entry
          ? JSON.stringify({ title: entry.title, company: entry.company, bullets: entry.bullets, description: entry.description }, null, 2)
          : JSON.stringify(data.workExperience.slice(0, 2), null, 2);
      }
      return JSON.stringify(data.workExperience.slice(0, 2), null, 2);
    }
    case "education":
      return JSON.stringify(data.education, null, 2);
    case "certifications":
      return data.certifications.map((c) => c.name).join("\n");
    default:
      return "";
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const asset = await prisma.userAsset.findFirst({ where: { id, userId: dbUser.id, type: "RESUME" } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const sectionId = body.sectionId as ResumeSectionId;
  if (!sectionId || !(sectionId in SECTION_LABELS)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }
  const entryLabel = typeof body.entryLabel === "string" ? body.entryLabel : undefined;
  const parsed = normalizeParsedResumeData(asset.parsedData);
  if (!parsed) return NextResponse.json({ error: "No resume data" }, { status: 404 });

  const draftSlice = sectionSlice(parsed, sectionId, entryLabel);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      issues: [],
      suggestions: draftSlice.trim()
        ? [
            {
              id: "dev-preview",
              label: "Dev preview",
              text: draftSlice.slice(0, 800) || "Add content — full AI suggestions on production.",
            },
          ]
        : [],
    });
  }

  const prompt = `You are an expert resume coach. Suggest concrete rewrites for ONE section of a resume.

Section: ${SECTION_LABELS[sectionId]}${entryLabel ? ` (${entryLabel})` : ""}

Current content:
${draftSlice.slice(0, 6000) || "(empty)"}

Return ONLY valid JSON:
{
  "issues": [
    {
      "severity": "Urgent|Critical|Optional|Minor",
      "title": "Short issue title",
      "issueDetected": "What is wrong",
      "whyItMatters": "Why recruiters care",
      "howToImprove": "Actionable fix"
    }
  ],
  "suggestions": [
    { "label": "Option name", "text": "Full rewritten section text ready to paste" }
  ]
}

Provide 1-3 suggestions with complete rewrite text. Do not fabricate employers or degrees.`;

  try {
    const message = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0]?.type === "text" ? message.content[0].text : "";
    const parsedResponse = parseJsonFromModel(text) as {
      issues?: Array<Record<string, unknown>>;
      suggestions?: Array<{ label?: string; text?: string }>;
    } | null;

    const issues = Array.isArray(parsedResponse?.issues)
      ? parsedResponse!.issues
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

    const suggestions = Array.isArray(parsedResponse?.suggestions)
      ? parsedResponse!.suggestions
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

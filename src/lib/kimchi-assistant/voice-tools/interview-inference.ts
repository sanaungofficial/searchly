import { kimchiGenerateText, isKimchiAiConfigured } from "@/lib/llm";

export type InterviewFormatInference = {
  likelyFormats: string[];
  likelyStages: string[];
  confirmQuestion: string;
  rationale: string;
  source: "job_posting" | "role_heuristic";
};

const BEHAVIORAL_SIGNALS =
  /\b(behavioral|star|tell me about a time|experience when|past situation|leadership principle|competency)\b/i;
const CASE_SIGNALS = /\b(case study|case interview|analytical|quantitative|market sizing|guesstimate)\b/i;
const TECH_SIGNALS = /\b(coding|technical|system design|live exercise|take.?home|portfolio review)\b/i;
const SCREEN_SIGNALS = /\b(recruiter screen|phone screen|hiring manager|panel|final round|onsite)\b/i;

function heuristicFromRole(role: string, company: string): InterviewFormatInference {
  const r = role.toLowerCase();
  const formats: string[] = ["behavioral"];
  if (/consult|strategy|analyst|finance|investment/.test(r)) formats.push("case / analytical");
  if (/engineer|developer|data scientist|architect/.test(r)) formats.push("technical");
  if (/product|program|operations|marketing|sales/.test(r)) formats.push("role-specific scenarios");

  return {
    likelyFormats: [...new Set(formats)].slice(0, 3),
    likelyStages: ["recruiter screen", "hiring manager"],
    confirmQuestion: `For ${role} at ${company}, I'm guessing a recruiter chat first, then behavioral with the hiring manager — does that sound right?`,
    rationale: "Inferred from role title — no job description loaded yet.",
    source: "role_heuristic",
  };
}

export async function inferInterviewFormat(params: {
  userId: string;
  role: string;
  company: string;
  description?: string | null;
  stage?: string | null;
}): Promise<InterviewFormatInference> {
  const { role, company, description, stage } = params;
  const desc = description?.trim() ?? "";

  if (!desc || desc.length < 80) {
    const base = heuristicFromRole(role, company);
    if (stage === "INTERVIEWING") {
      base.likelyStages = ["active interview process"];
    }
    return base;
  }

  const formats: string[] = [];
  if (BEHAVIORAL_SIGNALS.test(desc)) formats.push("behavioral");
  if (CASE_SIGNALS.test(desc)) formats.push("case / analytical");
  if (TECH_SIGNALS.test(desc)) formats.push("technical");
  if (formats.length === 0) formats.push("behavioral", "role-fit conversation");

  const stages: string[] = [];
  if (SCREEN_SIGNALS.test(desc)) {
    if (/recruiter|phone screen/i.test(desc)) stages.push("recruiter screen");
    if (/hiring manager|hm/i.test(desc)) stages.push("hiring manager");
    if (/panel|onsite|final/i.test(desc)) stages.push("panel / onsite");
  }
  if (stages.length === 0) stages.push("mixed — confirm with candidate");

  if (isKimchiAiConfigured() && desc.length >= 200) {
    try {
      const { text } = await kimchiGenerateText({
        tier: "analyze",
        prompt: `From this job posting excerpt, infer interview format for voice coaching. Return ONLY JSON:
{"likelyFormats":["behavioral"],"likelyStages":["recruiter screen","HM behavioral"],"confirmQuestion":"one short spoken question to confirm with candidate","rationale":"one sentence"}

Role: ${role} at ${company}
Posting excerpt:
${desc.slice(0, 3500)}`,
        maxOutputTokens: 280,
        userId: params.userId,
        tags: ["feature:voice-interview-infer"],
      });
      const json = text.match(/\{[\s\S]*\}/);
      if (json) {
        const parsed = JSON.parse(json[0]) as Partial<InterviewFormatInference>;
        if (parsed.confirmQuestion && Array.isArray(parsed.likelyFormats)) {
          return {
            likelyFormats: parsed.likelyFormats.slice(0, 4),
            likelyStages: Array.isArray(parsed.likelyStages) ? parsed.likelyStages.slice(0, 4) : stages,
            confirmQuestion: parsed.confirmQuestion.slice(0, 220),
            rationale: (parsed.rationale ?? "From job posting text.").slice(0, 200),
            source: "job_posting",
          };
        }
      }
    } catch {
      /* fallback below */
    }
  }

  const formatLabel = formats.join(" + ");
  return {
    likelyFormats: formats.slice(0, 4),
    likelyStages: stages.slice(0, 4),
    confirmQuestion: `From the listing, this looks like ${formatLabel} — does that match what you're expecting?`,
    rationale: "Inferred from job description keywords.",
    source: "job_posting",
  };
}

import { prisma } from "@/lib/prisma";

/* ── Prompt metadata ── */
export interface PromptMeta {
  label: string;
  description: string;
  category: string;
  variables: string[];
}

export const PROMPT_META: Record<string, PromptMeta> = {
  RESUME_BULLETS: {
    label: "Resume Bullets",
    description: "Generates 4 tailored resume bullet points + a summary line for a specific job.",
    category: "Resume",
    variables: ["userName", "company", "role", "profileContext", "jobNotes", "resumeInstruction"],
  },
  COVER_LETTER_QUICK: {
    label: "Cover Letter (Quick)",
    description: "Quick 3-paragraph cover letter generated from the job panel.",
    category: "Cover Letter",
    variables: ["userName", "company", "role", "profileContext", "jobNotes", "resumeInstruction"],
  },
  FIT_ANALYSIS: {
    label: "Fit Analysis",
    description: "Analyzes how well the candidate fits a specific role.",
    category: "Jobs",
    variables: ["userName", "company", "role", "profileContext", "jobNotes", "resumeInstruction"],
  },
  CHAT_SYSTEM: {
    label: "Scout Chat System Prompt",
    description: "System prompt for the Scout AI job search coach. Sets personality and context.",
    category: "Chat",
    variables: ["pipelineContext", "focusContext", "resumeContext"],
  },
  COVER_LETTER_FULL: {
    label: "Cover Letter (Full)",
    description: "Full cover letter generated from a complete job description and resume.",
    category: "Cover Letter",
    variables: ["jobTitle", "company", "description", "resumeSlice", "candidateName"],
  },
  JOB_PARSE: {
    label: "Job URL Parser",
    description: "Extracts structured job data from a scraped job posting page.",
    category: "Jobs",
    variables: ["url", "pageText"],
  },
  JOB_MATCH: {
    label: "Job Match Analysis",
    description: "Scores resume vs. job description match with keyword analysis.",
    category: "Jobs",
    variables: ["jobTitle", "company", "description", "resumeSlice"],
  },
  ROLE_GAP: {
    label: "Role Gap Analysis",
    description: "Analyzes gaps between candidate's resume and a target role.",
    category: "Profile",
    variables: ["role", "resumeSlice", "declaredSkills"],
  },
  READBACK: {
    label: "Profile Readback",
    description: "Generates an honest profile summary: picture, strengths, target roles, honest note.",
    category: "Profile",
    variables: ["resumeSlice"],
  },
  PROFILE_SUGGESTIONS: {
    label: "Profile Improvement Suggestions",
    description: "Generates 5-7 specific improvement suggestions for resume, LinkedIn, and skills.",
    category: "Profile",
    variables: ["resumeSlice", "linkedinUrl", "headline", "skills", "targetRoles"],
  },
  RESUME_TAILOR: {
    label: "Resume Tailor",
    description: "Parses and tailors a resume for a specific job. Returns JSON sections.",
    category: "Resume",
    variables: ["company", "role", "jobNotes", "resumeText"],
  },
  RESUME_TAILOR_REGEN: {
    label: "Resume Tailor (Aggressive)",
    description: "More aggressive resume rewrite for a specific job. Used on regenerate.",
    category: "Resume",
    variables: ["company", "role", "jobNotes", "resumeText"],
  },
  RESUME_MATCH: {
    label: "Resume Keyword Match",
    description: "Extracts 12-15 key skills/terms from a job description for keyword matching.",
    category: "Resume",
    variables: ["jobContext"],
  },
  RESUME_PARSE: {
    label: "Resume Parser",
    description: "Extracts structured JSON (name, education, work experience, skills) from a resume.",
    category: "Resume",
    variables: [],
  },
};

/* ── Default prompt content ── */
export const PROMPT_DEFAULTS: Record<string, string> = {
  RESUME_BULLETS: `You are a professional resume writer helping {{userName}} tailor their resume for a job at {{company}} as {{role}}.

{{profileContext}}
{{jobNotes}}

{{resumeInstruction}} 4 strong, tailored resume bullet points for this role. Each bullet should:
- Start with a strong action verb
- Include specific metrics or impact where possible
- Be relevant to what {{company}} likely looks for in a {{role}}
- Be 1-2 sentences max

Also generate a short 1-sentence resume summary line tailored to {{company}}.

Respond in this exact JSON format:
{
  "bullets": [
    { "tailored": "bullet text", "hint": "why this matters for this role" },
    { "tailored": "bullet text", "hint": "why this matters for this role" },
    { "tailored": "bullet text", "hint": "why this matters for this role" },
    { "tailored": "bullet text", "hint": "why this matters for this role" }
  ],
  "summary": "one sentence summary"
}`,

  COVER_LETTER_QUICK: `You are a professional cover letter writer helping {{userName}} apply for {{role}} at {{company}}.

{{profileContext}}
{{jobNotes}}

{{resumeInstruction}} a compelling, concise cover letter (3 short paragraphs). It should:
- Open with a specific, non-generic hook about {{company}}
- Connect the candidate's background to the role
- Close with a clear call to action
- Sound like a real human wrote it, not a bot
- Be direct and confident, not sycophantic

Respond with just the cover letter text, no subject line or "Dear Hiring Manager" header — start directly with the opening paragraph.`,

  FIT_ANALYSIS: `You are a career strategist helping {{userName}} understand their fit for {{role}} at {{company}}.

{{profileContext}}
{{jobNotes}}

{{resumeInstruction}} and explain:
1. Why this person is a strong candidate for this role (2-3 specific strengths)
2. Any potential gaps or things to address in the application
3. One tactical tip for standing out

Keep it honest, direct, and actionable. No fluff. Format as:

**Why you're a strong fit:**
[2-3 bullet points]

**Potential gaps to address:**
[1-2 bullet points]

**Tactic to stand out:**
[one concrete tip]`,

  CHAT_SYSTEM: `You are Scout, an AI job search coach built into Kimchi — a job search workspace for senior professionals targeting roles in Product Management, Corporate Strategy, and Operations.

Your job is to help the user land their next role. You're direct, practical, and honest — not a cheerleader. You give specific, actionable advice. You know how hiring actually works at senior levels.

You know about the user's job search:{{pipelineContext}}{{focusContext}}{{resumeContext}}

When discussing specific jobs, reference what you know about them. When the user asks about their background, qualifications, or experience, use their resume to give specific answers. Keep responses concise — 2-4 short paragraphs max unless they ask for something longer. No corporate fluff.`,

  COVER_LETTER_FULL: `You are a professional cover letter writer. Write a compelling, personalized cover letter for this candidate.

JOB:
Title: {{jobTitle}}
Company: {{company}}
Description:
{{description}}

CANDIDATE RESUME:
{{resumeSlice}}

Write a 3-paragraph cover letter that:
1. Opens with a specific hook referencing something real about the company or role (not generic)
2. Highlights 2-3 concrete achievements from the resume most relevant to this role with specific metrics where available
3. Closes with genuine enthusiasm and a clear call to action

Rules:
- Do NOT use the phrase "I am writing to express my interest"
- Do NOT use "I am excited about this opportunity" or similar filler
- Do NOT use em dashes
- Write in first person as {{candidateName}}
- Keep it under 300 words
- Professional but not stiff — conversational and direct
- No salutation (Dear Hiring Manager) or sign-off — just the body paragraphs

Return ONLY the cover letter text, no JSON, no labels, no extra commentary.`,

  JOB_PARSE: `Extract job posting details from this page content. Return ONLY valid JSON, no other text.

Page URL: {{url}}
Page content: {{pageText}}

Return this exact JSON shape:
{
  "company": "company name or null",
  "role": "job title or null",
  "location": "city/remote or null",
  "salary": "salary range as string or null",
  "description": "2-3 sentence summary of the role and what the company does",
  "requirements": ["key requirement 1", "key requirement 2", "key requirement 3", "key requirement 4", "key requirement 5"]
}

If you cannot determine a field, use null. Requirements should be the 4-5 most important ones, concise.`,

  JOB_MATCH: `You are analyzing how well a candidate's resume matches a job posting.

JOB:
Title: {{jobTitle}}
Company: {{company}}
Description:
{{description}}

CANDIDATE RESUME:
{{resumeSlice}}

Analyze the match and return a JSON object with this exact shape:
{
  "score": <number 0-10, one decimal place>,
  "scoreLabel": <"Poor" | "Fair" | "Good" | "Strong" | "Excellent">,
  "jobTitle": "{{jobTitle}}",
  "resumeTitle": <candidate's most recent/relevant job title from resume>,
  "yoeRequired": <years of experience the job requires, as string e.g. "4+ years" or "Not specified">,
  "yoeCandidate": <candidate's total years of relevant experience, as string e.g. "8 years">,
  "yoeMatch": <true if candidate meets or exceeds requirement>,
  "industries": <array of industry strings the job mentions>,
  "industryMatch": <true if candidate has relevant industry experience>,
  "keywords": <array of up to 12 objects: { "text": string, "matched": boolean } — pull the most important keywords/skills from the job, mark matched:true if found in resume>,
  "summaryNote": <1 sentence assessment of the candidate's summary/objective alignment with this role>
}

Return ONLY the JSON object, no markdown.`,

  ROLE_GAP: `You are a career coach analyzing a resume against a specific target role.

TARGET ROLE: {{role}}

RESUME:
{{resumeSlice}}

USER'S DECLARED SKILLS: {{declaredSkills}}

Analyze this person's fit for the target role. Factor in both the resume content AND the declared skills above.

Return a JSON object with exactly these fields:

{
  "fitScore": <integer 0-100, honest assessment based on their resume and declared skills>,
  "summary": "<1 sentence in second person describing their fit, specific to their actual experience, under 25 words>",
  "requiredSkills": [
    "<skill>", "<skill>", "<skill>", "<skill>", "<skill>",
    "<skill>", "<skill>", "<skill>", "<skill>", "<skill>"
  ],
  "gaps": [
    { "skill": "<specific gap>", "why": "<1 sentence explaining why this matters for the target role>" },
    { "skill": "<specific gap>", "why": "<1 sentence>" },
    { "skill": "<specific gap>", "why": "<1 sentence>" }
  ],
  "nextSteps": [
    "<concrete action they can take this week>",
    "<concrete action they can take this month>"
  ]
}

Scoring guide:
- 70-100: Strong foundation, likely to land interviews
- 50-69: Good fit with identifiable gaps to close
- 0-49: Significant gaps, needs a longer transition plan

Rules:
- requiredSkills: exactly 10, the most important skills for THIS role (mix of technical and soft). Include skills they already have AND gaps. Use short, specific skill names (e.g. "SQL", "Stakeholder management", "P&L ownership").
- gaps: exactly 3, the most impactful skills from requiredSkills that are missing from their resume and declared skills
- nextSteps: actionable and specific, not generic career advice like "network more"
- summary: must be specific to their actual resume, not a generic statement
- Respond with only valid JSON, no explanation`,

  READBACK: `You are analyzing a resume to generate a brief, honest profile summary for a job search tool.

RESUME:
{{resumeSlice}}

Generate a profile read-back with these exact fields:

1. "picture" — A 1-2 sentence summary of who this person is professionally. Use second-person ("You're a..."). Be specific to what's actually in their resume — mention their actual function, years of experience if evident, and 1-2 distinctive traits. Keep it under 40 words. Be direct, not flattering.

2. "strengths" — Exactly 3-4 skill/strength tags extracted from their actual experience. Short noun phrases (2-4 words each). These should be skills a recruiter would notice from this specific resume.

3. "targetRoles" — Exactly 3 realistic roles this person could plausibly land based on their background. Be specific (e.g. "Director of Strategy" not just "Manager"). For each role include a fit level: "Strong match", "Good fit", or "Worth exploring".

4. "honestNote" — 1-2 sentences about a genuine gap or weakness in their profile that they should address. Be honest, not harsh. Focus on something actionable.

Respond in this exact JSON format:
{
  "picture": "You're a...",
  "strengths": ["Skill One", "Skill Two", "Skill Three"],
  "targetRoles": [
    { "role": "Role Title", "fit": "Strong match" },
    { "role": "Role Title", "fit": "Good fit" },
    { "role": "Role Title", "fit": "Worth exploring" }
  ],
  "honestNote": "..."
}`,

  PROFILE_SUGGESTIONS: `You are analyzing a professional profile to generate specific, actionable improvement suggestions.

PROFILE DATA:
Resume:
{{resumeSlice}}

LinkedIn URL: {{linkedinUrl}}
Headline: {{headline}}
Skills listed: {{skills}}
Target roles: {{targetRoles}}

Generate 5-7 specific suggestions based on actual content from their profile above. Not generic advice.

Categories must be one of: "LinkedIn", "Resume", "Skills"
Priority must be one of: "high", "medium", "low"

Return ONLY a JSON array ordered by priority (high first):
[
  {
    "priority": "high",
    "category": "Resume",
    "title": "Concise suggestion title",
    "detail": "Specific detail referencing their actual profile content",
    "impact": "3-6 word impact phrase"
  }
]`,

  RESUME_TAILOR: `You are a professional resume writer. Parse and tailor this resume for the given job.

JOB:
Company: {{company}}
Role: {{role}}
Notes: {{jobNotes}}

BASE RESUME TEXT:
{{resumeText}}

Return a JSON array of resume sections. Each section:
{ "id": "unique-id", "title": "Section Title", "type": "text"|"bullets"|"header", "content": "content string" }

For "bullets" type, content is newline-separated bullet points (no dashes).
For "header" type, content is the person's name/contact info.
For "text" type, content is a paragraph.

Include sections: Personal Info (header), Professional Summary (text), Experience (bullets), Education (text), Skills (bullets).
Tailor the Professional Summary and highlight relevant Experience to match the job role and company.

Return ONLY the JSON array, no other text.`,

  RESUME_TAILOR_REGEN: `Rewrite and tailor this resume for the job below. Be more aggressive in aligning the language and priorities to the job requirements.

JOB:
Company: {{company}}
Role: {{role}}
Notes: {{jobNotes}}

BASE RESUME:
{{resumeText}}

Return a JSON array of resume sections. Each section:
{ "id": "unique-id", "title": "Section Title", "type": "text"|"bullets"|"header", "content": "content string" }

For "bullets" type, content is newline-separated bullet points.
For "header" type, content is the person's name/contact info.
For "text" type, content is a paragraph.

Return ONLY the JSON array, no other text.`,

  RESUME_MATCH: `Extract the 12-15 most important skills, technologies, and qualifications from this job description. Focus on specific, concrete terms (not vague phrases like "communication skills" or "team player").

JOB:
{{jobContext}}

Return ONLY a JSON array of strings, e.g. ["SQL", "product roadmap", "stakeholder management", "Python"]
Return ONLY the JSON array, no other text.`,

  RESUME_PARSE: `Extract the following from this resume and return ONLY valid JSON, no markdown, no explanation:

{
  "name": "full name or null",
  "phone": "phone number or null",
  "location": "city, state or null",
  "website": "personal website or null",
  "education": [
    {
      "id": "edu_0",
      "school": "school name",
      "degree": "degree type (e.g. Bachelor of Science)",
      "field": "field of study or null",
      "from": "YYYY-MM or null",
      "to": "YYYY-MM or null or 'Present'"
    }
  ],
  "workExperience": [
    {
      "id": "exp_0",
      "company": "company name",
      "title": "job title",
      "description": "one sentence description of the role or null",
      "from": "YYYY-MM or null",
      "to": "YYYY-MM or null or 'Present'",
      "bullets": ["achievement or responsibility bullet point"]
    }
  ],
  "skills": ["skill1", "skill2"]
}

Rules:
- IDs must be unique strings like edu_0, edu_1, exp_0, exp_1 etc.
- workExperience should be ordered newest first
- Include all jobs and education entries
- Extract every skill mentioned
- Return ONLY the JSON object, nothing else`,
};

/* ── Runtime interpolation ── */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

/* ── In-memory 60-second cache ── */
const cache = new Map<string, { content: string; expiresAt: number }>();

export function invalidatePromptCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

/* ── getPrompt: fetch from DB with auto-seed ── */
export async function getPrompt(key: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.content;

  const defaultContent = PROMPT_DEFAULTS[key] ?? "";
  const meta = PROMPT_META[key];

  try {
    let row = await prisma.promptConfig.findUnique({ where: { key } });

    if (!row && meta && defaultContent) {
      try {
        row = await prisma.promptConfig.create({
          data: {
            key,
            label: meta.label,
            description: meta.description,
            category: meta.category,
            content: defaultContent,
            defaultContent,
          },
        });
      } catch {
        row = await prisma.promptConfig.findUnique({ where: { key } });
      }
    }

    const content = row?.content ?? defaultContent;
    cache.set(key, { content, expiresAt: now + 60_000 });
    return content;
  } catch {
    return defaultContent;
  }
}

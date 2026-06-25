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
  VECTOR_JOB_MATCH_BATCH: {
    label: "Vector Job Match (Batch)",
    description: "Explains why each Hirebase vector-search job fits the candidate resume.",
    category: "Jobs",
    variables: ["resumeSlice", "jobBlocks"],
  },
  READBACK: {
    label: "Profile Readback",
    description: "Generates an honest profile summary: picture, strengths, target roles, honest note.",
    category: "Profile",
    variables: ["resumeSlice"],
  },
  CAREER_STRATEGY: {
    label: "Career Strategy Document",
    description: "Generates a full job search strategy document from profile, resume, intake notes, and watchlist.",
    category: "Profile",
    variables: [
      "candidateName",
      "resumeSlice",
      "targetRoles",
      "targetSalary",
      "currentSalary",
      "employmentStatus",
      "jobTimeline",
      "careerMotivation",
      "priorities",
      "targetMarket",
      "currentLocation",
      "relocationOpenness",
      "workAuthorization",
      "securityClearance",
      "searchDuration",
      "positioningStatement",
      "headline",
      "summary",
      "workArrangement",
      "declaredSkills",
      "experienceSummary",
      "readbackPicture",
      "readbackStrengths",
      "readbackHonestNote",
      "readbackSuggestedRoles",
      "trackedCompaniesSummary",
      "intakeNotes",
    ],
  },
  STRATEGY_INTAKE_PARSE: {
    label: "Strategy Intake Parser",
    description: "Extracts structured profile fields from pasted client intake notes.",
    category: "Profile",
    variables: ["intakeNotes", "targetRoles", "targetSalary", "currentSalary", "targetMarket", "headline"],
  },
  PROFILE_COACH_SYSTEM: {
    label: "Profile Coach Chat",
    description: "System prompt for profile/strategy coaching chat while impersonating a client.",
    category: "Chat",
    variables: ["candidateName", "profileContext", "intakeNotes", "strategySummary"],
  },
  PROFILE_SUGGESTIONS: {
    label: "Profile Improvement Suggestions",
    description: "Generates 5-7 specific improvement suggestions for resume, LinkedIn, and skills.",
    category: "Profile",
    variables: ["resumeSlice", "linkedinUrl", "headline", "skills", "targetRoles"],
  },
  LINKEDIN_DRAFT: {
    label: "LinkedIn Profile Draft",
    description: "Transforms resume data into a LinkedIn-shaped profile with headline, About, and paragraph experience.",
    category: "Profile",
    variables: ["name", "targetRoles", "resumeJson"],
  },
  LINKEDIN_DRAFT_ANALYSIS: {
    label: "LinkedIn Draft Analysis",
    description: "Scores a LinkedIn profile draft and returns section-specific improvements.",
    category: "Profile",
    variables: ["draftJson"],
  },
  LINKEDIN_SECTION_SUGGEST: {
    label: "LinkedIn Section Fix",
    description: "Generates rewrite options for one LinkedIn section.",
    category: "Profile",
    variables: ["sectionId", "sectionLabel", "entryLabel", "draftSlice", "targetRoles"],
  },
  RESUME_SECTION_SUGGEST: {
    label: "Resume Section Fix",
    description: "Generates rewrite options for one resume section.",
    category: "Resume",
    variables: ["sectionId", "sectionLabel", "entryLabel", "draftSlice", "targetRoles"],
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
    description: "Extracts structured JSON (contact, summary, education, experience, skills, certifications) from a resume.",
    category: "Resume",
    variables: [],
  },
  RESUME_ASSET_ANALYSIS: {
    label: "Resume Asset Analysis",
    description: "Scores a resume and returns strengths, gaps, and improvement tips.",
    category: "Resume",
    variables: ["resumeSlice"],
  },
  COMPANY_JOBS_SCAN: {
    label: "Company Careers Scan",
    description: "Extracts open job listings from a careers page HTML snapshot. Shared across all users tracking the same company.",
    category: "Companies",
    variables: ["careersUrl", "pageText"],
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

  VECTOR_JOB_MATCH_BATCH: `You are a career coach. Hirebase vector search ranked these jobs against a candidate's resume (rank 1 = strongest semantic match). Explain WHY each job fits this specific person.

RESUME:
{{resumeSlice}}

JOBS:
{{jobBlocks}}

For each job, return honest fit analysis grounded in the resume — cite concrete experience, skills, or seniority alignment. Do not invent credentials.

Return JSON only:
{
  "matches": [
    {
      "jobId": "<exact JOB id from blocks>",
      "matchScore": <integer 0-100>,
      "matchLabel": "<Excellent|Strong|Good|Fair|Stretch>",
      "reasons": ["<specific reason 1>", "<specific reason 2>", "<optional reason 3>"],
      "matchedSkills": ["<skill already in resume>", "..."],
      "gapSkills": ["<skill gap if any>", "..."]
    }
  ]
}

Rules:
- Include every job from the list, same jobId values
- reasons: 2-3 short bullets, second person ("Your…"), specific to this resume
- matchedSkills: up to 6 skills/tools from the job that the resume supports
- gapSkills: up to 3 notable gaps (empty array if strong fit)
- matchScore should correlate with vector rank but reflect real fit, not rank alone`,

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

  CAREER_STRATEGY: `You are a senior executive career strategist preparing a confidential Job Search Strategy document (CareerElevator style) for {{candidateName}}.

Use ALL context below. The intake notes from the coach are authoritative when they conflict with sparse profile data. Do NOT invent target companies — the watchlist below is reference only; do not duplicate it as a strategy section (companies render separately in the product).

PROFILE & SEARCH PARAMETERS:
- Target roles (profile): {{targetRoles}}
- Target salary: {{targetSalary}} | Current salary: {{currentSalary}}
- Employment status: {{employmentStatus}} | Timeline: {{jobTimeline}}
- Motivation: {{careerMotivation}} | Priorities: {{priorities}}
- Current location: {{currentLocation}} | Target market: {{targetMarket}}
- Relocation: {{relocationOpenness}} | Work arrangement prefs: {{workArrangement}}
- Work authorization: {{workAuthorization}} | Security clearance: {{securityClearance}}
- Search duration: {{searchDuration}}
- Headline: {{headline}} | Positioning statement: {{positioningStatement}}
- Professional summary: {{summary}}

READBACK (AI prior analysis):
Picture: {{readbackPicture}}
Strengths: {{readbackStrengths}}
Honest note: {{readbackHonestNote}}
Suggested roles: {{readbackSuggestedRoles}}

EXPERIENCE SUMMARY: {{experienceSummary}}
SKILLS: {{declaredSkills}}

WATCHLIST (reference — do not list as target companies section):
{{trackedCompaniesSummary}}

COACH INTAKE NOTES (client answers from external form):
{{intakeNotes}}

RESUME:
{{resumeSlice}}

Generate a comprehensive strategy as JSON with this exact structure (all string fields required; use empty string or empty arrays if unknown):
{
  "executiveSummary": "2-4 paragraphs: who they are, key outcomes, search context, sector/translation issues if any",
  "placementReadiness": {
    "categories": [
      { "category": "Category name", "score": "Strong|Moderate|At Risk|High Risk|Good", "assessment": "1-2 sentences" }
    ],
    "overallReadiness": "Moderate — Active Reset Needed",
    "overallAssessment": "1-2 sentence summary"
  },
  "positioningStrategy": {
    "coreDirective": "The single most important repositioning change",
    "positioningStatement": "First-person quote block the candidate can use (3-5 sentences)",
    "angles": [
      { "title": "Angle name", "description": "When and how to lead with this", "whenToUse": "Audience type" }
    ]
  },
  "targetRolesStrategy": {
    "intro": "How to allocate effort across tiers",
    "tiers": [
      {
        "tier": "Tier 1: Highest-Fit Roles",
        "allocationPercent": 50,
        "roles": [
          { "title": "Role title", "typicalEmployer": "Employer types", "whyItFits": "Why it fits this candidate" }
        ]
      }
    ]
  },
  "searchExecutionStrategy": {
    "intro": "Reset narrative if search has stalled",
    "channelMix": [
      { "channel": "Networking", "effortPercent": 45, "weeklyTarget": "8-10 conversations/wk", "keyActions": "Specific actions" }
    ],
    "addressingSearchGap": {
      "title": "Addressing search duration gap",
      "narrative": "Recommended narrative for interviews",
      "tips": ["tip1", "tip2"]
    },
    "networkingStrategy": {
      "intro": "Leverage existing assets",
      "assets": [{ "asset": "Network name", "approach": "How to use it" }]
    }
  },
  "actionPlan": {
    "phases": [
      { "label": "Weeks 1–3: Reset & Relaunch", "items": ["action1", "action2"] }
    ]
  },
  "competitiveDifferentiators": [
    { "differentiator": "Short label", "howToArticulate": "How to say it in interviews" }
  ],
  "salaryMarketContext": {
    "intro": "Market context for their target range",
    "benchmarks": [{ "roleType": "Role type", "range": "$X–$Y", "notes": "optional" }]
  },
  "risksAndMitigations": [
    { "risk": "Risk name", "impact": "HIGH|MEDIUM|LOW", "mitigation": "Mitigation approach" }
  ],
  "pathForward": {
    "summary": "Closing synthesis paragraph",
    "keyChanges": ["change 1", "change 2", "change 3"],
    "closing": "Final motivating paragraph"
  }
}

Be specific, honest, and executive-level. Use metrics from the resume. Include 4-6 readiness categories and 3 positioning angles when possible.

Respond with ONLY the JSON object — no markdown code fences, no commentary before or after.`,

  STRATEGY_INTAKE_PARSE: `You are parsing client intake notes from an external career coaching / onboarding form into structured profile fields for Kimchi.

EXISTING PROFILE (may be incomplete — prefer new evidence from intake when richer):
- Target roles: {{targetRoles}}
- Target salary: {{targetSalary}}
- Current salary: {{currentSalary}}
- Target market: {{targetMarket}}
- Headline: {{headline}}

INTAKE NOTES TO PARSE:
{{intakeNotes}}

SECURITY — NEVER extract or return: LinkedIn passwords, login credentials, full mailing addresses, or SSNs. Omit those entirely.

Map common onboarding questions:
- Employment / "currently employed" → employmentStatus: employed | searching | open
- Recent employer + title → recentEmployer, recentTitle in intakeContext; also draft headline (e.g. "Associate at McKinsey | Fintech Strategy")
- Work authorization / citizenship → workAuthorization
- Current base salary → currentSalary (e.g. "$200,000")
- Target salary range + floor → targetSalary (e.g. "$200K–$249K (floor $195K)")
- Location / cities → targetMarket (include primary + relocation targets, e.g. "Chicago, IL (open: NYC, SF)")
- Relocation willingness → relocationOpenness
- Work arrangement (remote/hybrid/onsite) → priorities array entry (e.g. "Hybrid (2–3 days in office)")
- Why leaving / motivation → careerMotivation
- Target role types (top 3) → targetRoles array (short labels)
- Industries, company stage, benefits, deal-breakers → priorities entries AND intakeContext fields
- Dream companies list → suggestedDreamCompanies (company names only, not duplicated elsewhere)
- Roles/industries to avoid → intakeContext.avoidNotes
- Search activity (apps, interviews) → searchDuration (e.g. "50 apps / 10 interviews last 30 days, actively searching")
- Timeline / moving quickly → jobTimeline: asap | 3-6mo | open
- One-sentence background + highlights + differentiators → summary and/or positioningStatement
- LinkedIn URL → linkedinUrl (URL only, never credentials)
- Active offers → intakeContext.activeOffers
- Biggest search frustration → include in careerMotivation or intakeContext.searchActivity

Extract every field you can find with clear evidence. Use priorities for multi-select preferences (work arrangement, industries, company stage, benefits, deal-breakers).

Respond in this exact JSON format:
{
  "summary": "1-2 sentences describing what you extracted",
  "fieldsFound": ["targetRoles", "targetSalary", ...],
  "proposed": {
    "name": "optional full name",
    "headline": "optional professional headline",
    "summary": "optional professional summary (2-4 sentences max)",
    "linkedinUrl": "https://linkedin.com/in/...",
    "targetRoles": ["Corp Dev / Internal Strategy", "GM / Business Ops", "Startup Ops Leadership"],
    "targetSalary": "e.g. $200K–$249K (floor $195K)",
    "currentSalary": "e.g. $200,000",
    "employmentStatus": "searching",
    "jobTimeline": "asap",
    "careerMotivation": "why leaving + what they want next",
    "priorities": ["Hybrid (2–3 days in office)", "Growth-stage companies", "Fintech", "15+ days PTO"],
    "targetMarket": "e.g. Chicago, IL (open: NYC, SF — prefer SF or Chicago)",
    "relocationOpenness": "e.g. Yes — NYC or San Francisco",
    "workAuthorization": "e.g. U.S. Citizen",
    "securityClearance": "optional",
    "searchDuration": "e.g. 50 applications / 10 interviews in last 30 days",
    "positioningStatement": "optional first-person positioning draft"
  },
  "suggestedDreamCompanies": ["Plaid", "Stripe", "Ramp"],
  "intakeContext": {
    "recentEmployer": "McKinsey",
    "recentTitle": "Associate",
    "industries": "Financial Services, Fintech",
    "companyStages": "Growth-stage, Large enterprise",
    "avoidNotes": "Pure strategy at large firms like Visa; wants ops + strategy mix",
    "searchActivity": "50 apps / 10 interviews last 30d; strong in interviews, needs more HM access",
    "activeOffers": "PE-owned fintech, Commercial New Product Lead, NYC",
    "benefitsMustHaves": "15+ PTO; equity can offset lower base",
    "dealBreakers": "Toxic culture / leadership"
  }
}`,

  PROFILE_COACH_SYSTEM: `You are Scout, Kimchi's profile and career strategy coach. You are helping a coach (admin) set up or refine a client's job search profile while they impersonate the client.

Client: {{candidateName}}

CURRENT PROFILE CONTEXT:
{{profileContext}}

SAVED INTAKE NOTES:
{{intakeNotes}}

CURRENT STRATEGY SUMMARY:
{{strategySummary}}

Your job:
1. Help parse and organize pasted client intake information
2. Suggest profile field updates (roles, salary, market, timeline, positioning)
3. Explain how profile changes would affect recommended jobs and the Career Strategy doc
4. Be direct and practical — executive search coach tone

When the coach pastes intake notes, summarize what you found and list specific profile fields to update. Do NOT claim you updated the profile — the coach must approve updates in the UI.

If they ask to generate or refresh the Career Strategy document, tell them to use the Generate button on the Career Strategy tab (uses 1 strategy credit).

Keep responses concise unless they ask for detail.`,

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
  "email": "email or null",
  "phone": "phone number or null",
  "location": "city, state or null",
  "website": "personal website or null",
  "linkedinUrl": "LinkedIn URL or null",
  "summary": "professional summary paragraph or null",
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
  "skills": ["skill1", "skill2"],
  "skillGroups": [
    { "id": "sg_0", "label": "Technical Skills", "skills": ["skill1", "skill2"] }
  ],
  "certifications": [
    { "id": "cert_0", "name": "certification name", "issuer": "issuer or null", "date": "YYYY-MM or null" }
  ]
}

Rules:
- IDs must be unique strings like edu_0, exp_0, sg_0, cert_0 etc.
- workExperience should be ordered newest first
- Each job is ONE object: company, title, dates, and ALL bullet points for that role go in the "bullets" array
- NEVER create a separate workExperience entry for an individual bullet or achievement line
- If a line is a responsibility under a role, it belongs in that role's bullets array — not as its own job
- Include all jobs, education entries, and certifications
- Extract every skill mentioned; group into skillGroups when the resume uses categories
- Return ONLY the JSON object, nothing else`,

  LINKEDIN_DRAFT: `You are a LinkedIn profile strategist. Transform the resume below into a LinkedIn profile draft. This is NOT a resume — write for LinkedIn discovery and recruiters.

Candidate name: {{name}}
Target roles: {{targetRoles}}

Resume data (JSON):
{{resumeJson}}

Return ONLY valid JSON in this exact shape:
{
  "headline": "max 120 chars — keyword-rich, pipe-separated, not just job title",
  "about": "max 2600 chars — professional voice, strong hook in first 2 lines, themes, soft CTA. Use paragraph breaks (\\n\\n). NOT resume bullets pasted verbatim.",
  "experience": [
    {
      "id": "li_exp_0",
      "title": "job title",
      "company": "company",
      "location": "city or remote or null",
      "from": "start date string",
      "to": "end date or Present",
      "description": "2-4 short paragraphs describing impact — convert resume bullets into LinkedIn prose. Use \\n\\n between paragraphs.",
      "resumeSourceId": "exp_0 or null"
    }
  ],
  "education": [
    {
      "id": "li_edu_0",
      "school": "institution",
      "degree": "degree name",
      "field": "field or null",
      "from": "start or null",
      "to": "end or null"
    }
  ],
  "skills": ["up to 50 skills ordered by recruiter relevance for target roles"],
  "featured": [
    { "id": "feat_0", "label": "Portfolio", "url": "https://..." }
  ]
}

Rules:
- Include ALL jobs and education from the resume
- Experience descriptions must be paragraphs, not bullet lists
- Headline must be ≤120 characters
- Skills: max 50, most relevant first
- featured: only include if portfolio/website exists in resume data
- Return ONLY the JSON object`,

  RESUME_ASSET_ANALYSIS: `You are a senior career coach reviewing a resume. Analyze the resume below and return ONLY valid JSON:

{
  "score": 0-100 integer,
  "headline": "2-3 sentence overall assessment of the resume",
  "strengths": ["strength 1", "strength 2"],
  "improvements": [
    { "priority": "Urgent", "title": "short issue title", "detail": "actionable fix" },
    { "priority": "Critical", "title": "short issue title", "detail": "actionable fix" },
    { "priority": "Optional", "title": "short issue title", "detail": "actionable fix" }
  ],
  "highlights": [
    {
      "category": "Relevance",
      "items": [
        {
          "severity": "Minor",
          "title": "Summary Needs Improvement",
          "issueCount": 1,
          "summary": "what is wrong in one sentence",
          "whyItMatters": "why recruiters care about this"
        }
      ]
    },
    {
      "category": "Impact & Achievements",
      "items": []
    },
    {
      "category": "Brevity & Effectiveness",
      "items": []
    }
  ]
}

Use priority values exactly: Urgent, Critical, or Optional.
Use severity values exactly: Minor, Urgent, Critical, or Optional.
Include 3 categories in highlights. Put at least 1 item in each category that has issues.
Include 8-15 total improvement items across improvements and highlights.

Resume:
{{resumeSlice}}

Return ONLY the JSON object.`,
  LINKEDIN_DRAFT_ANALYSIS: `You are a LinkedIn profile coach reviewing a draft LinkedIn profile (NOT a resume). Score how recruiter-ready it is for discovery and inbound interest.

Return ONLY valid JSON:
{
  "score": 0-100 integer,
  "headline": "2-3 sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "improvements": [
    { "priority": "Urgent", "title": "short issue title", "detail": "actionable fix for LinkedIn" },
    { "priority": "Critical", "title": "short issue title", "detail": "actionable fix" },
    { "priority": "Optional", "title": "short issue title", "detail": "actionable fix" }
  ],
  "highlights": [
    {
      "category": "Discovery & Headline",
      "items": [
        {
          "severity": "Urgent",
          "title": "Headline lacks keywords",
          "issueCount": 1,
          "summary": "what is wrong",
          "whyItMatters": "why recruiters care",
          "sectionHint": "headline"
        }
      ]
    },
    {
      "category": "About & Story",
      "items": []
    },
    {
      "category": "Experience & Impact",
      "items": []
    }
  ]
}

Use priority: Urgent, Critical, or Optional.
Use severity: Minor, Urgent, Critical, or Optional.
sectionHint must be one of: headline, about, experience, education, skills.
For experience issues, mention the specific company or role title when possible.
Focus on LinkedIn norms: keyword headline, scannable About hook, paragraph impact in experience, skills for search.
Include 8-12 improvements across improvements and highlights.

LinkedIn draft JSON:
{{draftJson}}

Return ONLY the JSON object.`,
  LINKEDIN_SECTION_SUGGEST: `You are a LinkedIn profile coach. Suggest concrete rewrites for ONE section of a LinkedIn draft.

Section: {{sectionLabel}}{{entryLabel}}
Target roles: {{targetRoles}}

Current content:
{{draftSlice}}

Return ONLY valid JSON:
{
  "issues": [
    {
      "severity": "Urgent",
      "title": "short issue title",
      "issueDetected": "what is weak or missing in one sentence",
      "whyItMatters": "why recruiters care about this on LinkedIn",
      "howToImprove": "specific actionable guidance"
    }
  ],
  "suggestions": [
    { "label": "Option A", "text": "full replacement text the user can apply" },
    { "label": "Option B", "text": "alternate rewrite" }
  ]
}

Rules:
- issues: 1-3 items specific to THIS section or role (not generic resume advice)
- suggestions: 2-3 complete rewrites the user can paste in (respect LinkedIn length norms)
- headline ≤120 chars; about uses short paragraphs with a strong first-line hook
- experience entry: rewrite ONLY the description field as 2-4 short paragraphs with metrics; do not repeat title/company/dates in the text
- education entry: suggest degree line improvements when entryLabel indicates a specific school
- skills: return a comma-separated list in suggestion text, ordered by recruiter search relevance
- Return ONLY the JSON object`,
  RESUME_SECTION_SUGGEST: `You are a senior career coach. Suggest concrete rewrites for ONE section of a resume.

Section: {{sectionLabel}}{{entryLabel}}
Target roles: {{targetRoles}}

Current content:
{{draftSlice}}

Return ONLY valid JSON:
{
  "issues": [
    {
      "severity": "Urgent",
      "title": "short issue title",
      "issueDetected": "what is weak or missing in one sentence",
      "whyItMatters": "why recruiters care about this",
      "howToImprove": "specific actionable guidance"
    }
  ],
  "suggestions": [
    { "label": "Option A", "text": "full replacement text the user can apply" },
    { "label": "Option B", "text": "alternate rewrite" }
  ]
}

Rules:
- issues: 1-3 items specific to THIS section (not generic advice)
- suggestions: 2-3 complete rewrites the user can paste in
- summary: return a full professional summary paragraph
- skills: return comma-separated skills ordered by relevance
- experience entry: return bullet lines separated by newlines (each line one accomplishment)
- education entry: suggest improved degree/school line
- Return ONLY the JSON object`,
  COMPANY_JOBS_SCAN: `You are extracting job listings from a company careers page.

Page URL: {{careersUrl}}
Page text (truncated):
{{pageText}}

Extract all visible job listings. For each job return:
- title: job title (string)
- location: city/state or "Remote" (string, null if not shown)
- department: team or department (string, null if not shown)
- url: direct link to the job posting (string, null if not extractable)

Return ONLY a JSON object: { "jobs": [...], "scanned_url": "{{careersUrl}}" }
If no jobs are found, return { "jobs": [], "scanned_url": "{{careersUrl}}" }
Do not include any explanation outside the JSON.`,
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

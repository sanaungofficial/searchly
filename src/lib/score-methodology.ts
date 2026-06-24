/** Copy for score explainer popovers — one variant per score type. */

export type ScoreExplainerVariant =
  | "job-match"
  | "vector-match"
  | "resume-quality"
  | "keyword-match"
  | "role-gap"
  | "profile-completeness"
  | "upskill-recommendations"
  | "upskill-progress"
  | "linkedin-quality";

export type ScoreExplainerContent = {
  title: string;
  subtitle: string;
  bullets: { title: string; body: string }[];
  scaleNote?: string;
};

export const SCORE_EXPLAINERS: Record<ScoreExplainerVariant, ScoreExplainerContent> = {
  "job-match": {
    title: "Resume–job match score",
    subtitle: "How well your resume fits a specific job posting.",
    bullets: [
      {
        title: "What we compare",
        body: "Your primary resume against the job title, description, and requirements from the listing URL or pasted text.",
      },
      {
        title: "How it's calculated",
        body: "AI reads both sides and scores alignment on job title, years of experience, industry background, and keyword overlap in the description.",
      },
      {
        title: "Score scale",
        body: "0–10 with labels (Excellent, Strong, Good, Fair, Poor). In some views we show this as 0–100% (score × 10).",
      },
      {
        title: "After tailoring",
        body: "Re-run match or tailor your resume to see an updated score reflecting your edits.",
      },
    ],
    scaleNote: "Excellent ≥ 8.5 · Strong ≥ 7 · Good ≥ 6 · Fair ≥ 4",
  },
  "vector-match": {
    title: "Recommended role match",
    subtitle: "How roles from your tracked companies rank against your profile.",
    bullets: [
      {
        title: "Where roles come from",
        body: "Openings at companies on your watchlist — matched to your target titles via Hirebase, same path as Companies → Matching roles.",
      },
      {
        title: "How the score is calculated",
        body: "Instant profile-based scoring (no Claude on this list): list rank among matches, keyword overlap with the posting, and skills found in your resume.",
      },
      {
        title: "Why you're a good fit",
        body: "Bullets highlight aligned skills, seniority, and keyword overlap — not AI-written prose unless you open full match analysis elsewhere.",
      },
      {
        title: "Not resume embed",
        body: "This view does not call Hirebase resume embed. For deep AI fit analysis on a saved job, use Analyze fit in the job drawer.",
      },
    ],
    scaleNote: "Excellent ≥ 90 · Strong ≥ 75 · Good ≥ 60 · Fair ≥ 50 · Stretch below 50",
  },
  "resume-quality": {
    title: "Resume quality score",
    subtitle: "Overall strength of your resume as a standalone document.",
    bullets: [
      {
        title: "What we analyze",
        body: "Structure, clarity, impact language, completeness of sections, and how recruiter-ready the document reads.",
      },
      {
        title: "How it's calculated",
        body: "AI scores your resume 0–100 and maps to a letter grade (A–F). If AI is unavailable, we fall back to section completeness.",
      },
      {
        title: "Not job-specific",
        body: "This score reflects general resume quality — use Match analysis for a specific role.",
      },
    ],
    scaleNote: "A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60",
  },
  "keyword-match": {
    title: "Keyword match",
    subtitle: "How many job-description keywords appear in your tailored resume.",
    bullets: [
      {
        title: "Keyword extraction",
        body: "AI pulls 12–15 important terms from the job description — skills, tools, and role-specific phrases.",
      },
      {
        title: "Match ratio",
        body: "Score = matched keywords ÷ total keywords × 100%. Green tags = found; red = missing from your resume.",
      },
      {
        title: "Use it for",
        body: "Quick sanity check after tailoring — aim to cover gaps without keyword stuffing.",
      },
    ],
  },
  "role-gap": {
    title: "Target role fit score",
    subtitle: "How ready your profile is for a dream role you're targeting.",
    bullets: [
      {
        title: "What we compare",
        body: "Your resume plus declared skills against the target role title — not a specific job posting.",
      },
      {
        title: "How it's calculated",
        body: "AI returns a 0–100 fit score, skills you already have, gaps to close, and suggested next steps.",
      },
      {
        title: "When to refresh",
        body: "Re-run after uploading a new resume or updating skills so the gap analysis stays current.",
      },
    ],
    scaleNote: "Strong fit ≥ 75 · Good foundation ≥ 55 · Gap to close below 55",
  },
  "profile-completeness": {
    title: "Profile completeness",
    subtitle: "How much of your Kimchi profile is filled in.",
    bullets: [
      {
        title: "Checklist-based",
        body: "Weighted points for name, contact, LinkedIn, resume, education, experience, skills, and job-search preferences.",
      },
      {
        title: "Not a fit score",
        body: "This measures profile setup — not how well you match any job. Complete it so Kimchi can tailor and recommend accurately.",
      },
      {
        title: "Goal",
        body: "80%+ unlocks the best experience for match analysis and recommendations.",
      },
    ],
  },
  "upskill-recommendations": {
    title: "Upskilling program recommendations",
    subtitle: "How Kimchi picks courses and certifications for your skill gaps.",
    bullets: [
      {
        title: "Where gaps come from",
        body: "AI role-gap analysis on Target Roles compares your resume and declared skills to each role. Choose Obtain this skill on a gap to queue it here.",
      },
      {
        title: "Catalog matching",
        body: "Each gap is matched against our curated catalog: closesGap tags, course titles, and descriptions. We use fuzzy skill matching (e.g. “SQL” ↔ “Data Analysis”).",
      },
      {
        title: "Search fallbacks",
        body: "If nothing in the catalog fits, we link to Coursera, LinkedIn Learning, and certification search results for that skill.",
      },
      {
        title: "Recommended paths ranking",
        body: "Courses that close an active gap sort to the top. Kimchi pick badges flag high-signal options for senior hiring — not paid placement.",
      },
      {
        title: "Mark as acquired",
        body: "When you finish a skill, mark it acquired — it moves to your profile skills and triggers a fit-score refresh on that target role.",
      },
    ],
  },
  "upskill-progress": {
    title: "Learning progress",
    subtitle: "How your completion percentage is calculated.",
    bullets: [
      {
        title: "What counts",
        body: "Items marked Completed in Recommended paths plus any custom entries in My learning.",
      },
      {
        title: "The percentage",
        body: "completed ÷ (catalog courses + your custom items) × 100. In-progress items do not count until marked complete.",
      },
      {
        title: "Self-tracked",
        body: "Progress is what you record — Kimchi does not verify enrollment or credentials with third-party platforms.",
      },
      {
        title: "Separate from fit score",
        body: "Course completion updates this tracker. Target role fit scores refresh when you mark a gap skill as acquired or change your resume.",
      },
    ],
  },
  "linkedin-quality": {
    title: "LinkedIn profile score",
    subtitle: "How recruiter-ready your Kimchi LinkedIn draft is.",
    bullets: [
      {
        title: "What we analyze",
        body: "Headline keywords, About hook and story, experience impact in LinkedIn-style paragraphs, education, and skills for search.",
      },
      {
        title: "AI on production",
        body: "Full analysis runs on production. Dev staging shows a completeness-based estimate when AI is unavailable.",
      },
      {
        title: "Fix & Impact",
        body: "Use Fix on any section for AI suggestions — same flow as resume review in Assets. Edit inline, then copy into LinkedIn.",
      },
      {
        title: "When to refresh",
        body: "Regenerate from resume or open View full report → Refresh after major edits.",
      },
    ],
    scaleNote: "Excellent ≥ 90 · Good ≥ 80 · Fair ≥ 70 · Needs work below 60",
  },
};

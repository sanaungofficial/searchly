/** Copy for score explainer popovers — one variant per score type. */

export type ScoreExplainerVariant =
  | "job-match"
  | "vector-match"
  | "resume-quality"
  | "keyword-match"
  | "role-gap"
  | "profile-completeness";

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
        title: "Semantic search",
        body: "Your resume is embedded and compared to live openings at companies on your watchlist via vector search.",
      },
      {
        title: "Blended score",
        body: "0–100 score combines how highly the role ranks in search with keyword overlap between your resume and the posting.",
      },
      {
        title: "AI enrichment",
        body: "When available, AI adds match reasons, matched skills, and gap skills — not just a rank number.",
      },
      {
        title: "Fresh listings",
        body: "Roles come from employer career pages and ATS feeds we scan multiple times per day.",
      },
    ],
    scaleNote: "Excellent ≥ 85 · Strong ≥ 70 · Good ≥ 55 · Fair ≥ 40",
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
};

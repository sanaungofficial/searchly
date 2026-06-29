/** Copy for score explainer popovers — one variant per score type. */

export type ScoreExplainerVariant =
  | "job-match"
  | "vector-match"
  | "network-match"
  | "coach-match"
  | "resume-quality"
  | "keyword-match"
  | "role-gap"
  | "profile-completeness"
  | "upskill-recommendations"
  | "upskill-progress"
  | "linkedin-quality"
  | "discovery-score";

export type ScoreExplainerContent = {
  title: string;
  subtitle: string;
  bullets: { title: string; body: string }[];
  scaleNote?: string;
};

export const SCORE_EXPLAINERS: Record<ScoreExplainerVariant, ScoreExplainerContent> = {
  "job-match": {
    title: "Resume–job match score",
    subtitle: "Here's how we calculate fit for a specific posting.",
    bullets: [
      {
        title: "What we compare",
        body: "Your primary resume against the job title, description, and requirements from the listing URL or pasted text.",
      },
      {
        title: "How it's calculated",
        body: "We read both sides and score alignment on job title, years of experience, industry background, and keyword overlap in the description.",
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
    title: "Discovery score",
    subtitle: "Ranks this role against your profile and the candidate pool — hover the score for why it ranks where it does.",
    bullets: [
      {
        title: "Where roles come from",
        body: "Openings at companies on your watchlist — matched to your target titles, same path as Companies → Matching roles.",
      },
      {
        title: "How the score is calculated",
        body: "Instant profile-based scoring (no full AI on this list): list rank among matches, keyword overlap with the posting, and skills found in your resume.",
      },
      {
        title: "What the bullets mean",
        body: "Bullets highlight aligned skills, seniority, and keyword overlap — not long AI prose unless you open full match analysis elsewhere.",
      },
      {
        title: "Not resume embed",
        body: "This view uses fast profile-based scoring. For deep fit analysis on a saved job, use Analyze fit in the job drawer.",
      },
    ],
    scaleNote: "Excellent ≥ 90 · Strong ≥ 75 · Good ≥ 60 · Fair ≥ 50 · Stretch below 50",
  },
  "coach-match": {
    title: "Alignment check",
    subtitle: "Fit for this specific role or coach — separate from discovery score, which ranks against the broader candidate pool.",
    bullets: [
      {
        title: "What we compare",
        body: "Your dashboard goals (from Home), resume, target roles, headline, and priorities against the coach's category, specialties, firms, and bio.",
      },
      {
        title: "How the score is calculated",
        body: "Instant heuristic scoring — no AI on the directory. When you have goals and profile, goals count ~55% and profile ~45%. Goals alone or profile alone still produce a score when only one is available.",
      },
      {
        title: "Stretch vs strong",
        body: "Stretch (below 50) means different primary focus — not a bad coach. Use Prepare for session chat to see if they're still worth an intro call.",
      },
      {
        title: "Deeper prep",
        body: "Open Prepare for session in the coach drawer for help with questions, session goals, and coach background — uses your full profile plus this coach's profile.",
      },
    ],
    scaleNote: "Excellent ≥ 90 · Strong ≥ 75 · Good ≥ 60 · Fair ≥ 50 · Stretch below 50",
  },
  "network-match": {
    title: "Network role match",
    subtitle: "Here's how we rank in-network roles against your profile.",
    bullets: [
      {
        title: "Where roles come from",
        body: "Shared through Kimchi's recruiter network — exclusive openings not listed on public job boards.",
      },
      {
        title: "How the score is calculated",
        body: "Instant profile-based scoring: keyword overlap with the posting and recruiter notes, target-title alignment, and relative rank among network roles.",
      },
      {
        title: "What the bullets mean",
        body: "Bullets highlight aligned industries, skills, and keyword overlap from your resume and target roles.",
      },
      {
        title: "Deeper analysis",
        body: "Open a role and use Analyze fit in the job drawer for full resume–job match on that posting.",
      },
    ],
    scaleNote: "Excellent ≥ 90 · Strong ≥ 75 · Good ≥ 60 · Fair ≥ 50 · Stretch below 50",
  },
  "resume-quality": {
    title: "Resume quality score",
    subtitle: "Here's how we score your resume as a standalone document.",
    bullets: [
      {
        title: "What we analyze",
        body: "Structure, clarity, impact language, completeness of sections, and how recruiter-ready the document reads.",
      },
      {
        title: "How it's calculated",
        body: "We score your resume 0–100 and map to a letter grade (A–F). If AI is unavailable, we fall back to section completeness.",
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
    subtitle: "Here's how we count job-description keywords in your tailored resume.",
    bullets: [
      {
        title: "Keyword extraction",
        body: "We pull 12–15 important terms from the job description — skills, tools, and role-specific phrases.",
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
    subtitle: "Here's how we measure readiness for a role you're targeting.",
    bullets: [
      {
        title: "What we compare",
        body: "Your resume plus declared skills against the target role title — not a specific job posting.",
      },
      {
        title: "How it's calculated",
        body: "We return a 0–100 fit score, skills you already have, gaps to close, and suggested next steps.",
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
    subtitle: "Here's how we measure how much of your profile is filled in.",
    bullets: [
      {
        title: "Checklist-based",
        body: "Weighted points for name, contact, LinkedIn, resume, education, experience, skills, and job-search preferences.",
      },
      {
        title: "Not a fit score",
        body: "This measures profile setup — not how well you match any job. Fill it in so we can score and recommend accurately.",
      },
      {
        title: "Goal",
        body: "80%+ gets you the most accurate match analysis and role recommendations.",
      },
    ],
  },
  "upskill-recommendations": {
    title: "Upskill program recommendations",
    subtitle: "Here's how we pick courses and certifications for your skill gaps.",
    bullets: [
      {
        title: "Where gaps come from",
        body: "Role-gap analysis on Target Roles compares your resume and declared skills to each role. Choose Obtain this skill on a gap to queue it here.",
      },
      {
        title: "Catalog matching",
        body: "Each gap is matched against our catalog: closesGap tags, course titles, and descriptions. We use fuzzy skill matching (e.g. “SQL” ↔ “Data Analysis”).",
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
    subtitle: "Here's how we calculate your completion percentage.",
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
        body: "Progress is what you record — we do not verify enrollment or credentials with third-party platforms.",
      },
      {
        title: "Separate from fit score",
        body: "Course completion updates this tracker. Target role fit scores refresh when you mark a gap skill as acquired or change your resume.",
      },
    ],
  },
  "linkedin-quality": {
    title: "LinkedIn profile score",
    subtitle: "Here's how we score recruiter-readiness of your Kimchi LinkedIn draft.",
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
        body: "Use Fix on any section for suggestions — same flow as resume review in Resumes. Edit inline, then copy into LinkedIn.",
      },
      {
        title: "When to refresh",
        body: "Regenerate from resume or open View full report → Refresh after major edits.",
      },
    ],
    scaleNote: "Excellent ≥ 90 · Good ≥ 80 · Fair ≥ 70 · Needs work below 60",
  },
  "discovery-score": {
    title: "Discovery Score",
    subtitle: "Your competitive ranking against professionals targeting similar roles.",
    bullets: [
      {
        title: "What we evaluate",
        body: "Resume strength, positioning clarity, market readiness, and competitive signals recruiters would notice.",
      },
      {
        title: "How it's calculated",
        body: "Each dimension scores 0–25 (100 total). We compare your profile story, completeness, and market signals to peers in your target roles.",
      },
      {
        title: "Hover for your breakdown",
        body: "Hover the score badge to see your personal dimension scores and what moved the needle.",
      },
      {
        title: "When to refresh",
        body: "Update your profile, resume, or LinkedIn — then revisit Discovery Score for an updated ranking.",
      },
    ],
    scaleNote: "Top 5% ≥ 80 · Strong ≥ 55 · Building ≥ 25 · Getting started below 25",
  },
};

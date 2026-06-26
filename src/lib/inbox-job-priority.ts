/** Heuristic score for surfacing job-search-related mail first (never hides other mail). */

const JOB_KEYWORDS = [
  "interview",
  "application",
  "applied",
  "recruiter",
  "hiring",
  "offer",
  "position",
  "role at",
  "candidate",
  "resume",
  "screening",
  "onsite",
  " phone screen",
  "job opportunity",
  "careers",
  "talent",
  "greenhouse",
  "lever.co",
  "workday",
  "ashby",
  "icims",
];

const JOB_FROM_HINTS = ["recruiting", "talent", "hr@", "careers@", "jobs@"];

export type JobRelevanceInput = {
  subject?: string | null;
  snippet?: string | null;
  from?: string | null;
  hasAgentActivity?: boolean;
};

export function scoreMessageJobRelevance(input: JobRelevanceInput): number {
  let score = 0;
  const text = `${input.subject ?? ""} ${input.snippet ?? ""} ${input.from ?? ""}`.toLowerCase();

  for (const kw of JOB_KEYWORDS) {
    if (text.includes(kw)) score += 2;
  }
  for (const hint of JOB_FROM_HINTS) {
    if (text.includes(hint)) score += 3;
  }
  if (input.hasAgentActivity) score += 20;

  return score;
}

export function sortMessagesByJobRelevance<T extends JobRelevanceInput & { date?: number | null }>(
  messages: T[],
): T[] {
  return [...messages].sort((a, b) => {
    const scoreDiff = scoreMessageJobRelevance(b) - scoreMessageJobRelevance(a);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.date ?? 0) - (a.date ?? 0);
  });
}

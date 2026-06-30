/**
 * Profile-based resume ↔ job comparison (no AI required).
 * Parses JD keywords, title, YoE, and industry overlap against resume text.
 */

import { usableKeywordSummary } from "./match-score";

function labelForScore(score: number): string {
  if (score >= 8.5) return "Strong";
  if (score >= 6) return "Good";
  if (score >= 4) return "Fair";
  return "Low";
}

export interface ResumeJobMatchKeyword {
  text: string;
  matched: boolean;
}

export interface ResumeJobMatchResult {
  score: number;
  scoreLabel: string;
  jobTitle: string;
  resumeTitle: string;
  jobTitleMatch: boolean;
  yoeRequired: string;
  yoeCandidate: string;
  yoeMatch: boolean;
  industries: string[];
  industryMatch: boolean;
  industryTags?: { label: string; matched: boolean }[];
  keywords: ResumeJobMatchKeyword[];
  summaryNote: string;
  _fallback?: boolean;
}

const STOP = new Set([
  "about", "ability", "across", "also", "and", "any", "are", "able", "been", "being",
  "both", "can", "company", "day", "days", "each", "etc", "experience", "for", "from",
  "have", "help", "high", "including", "into", "job", "join", "like", "make", "more",
  "must", "need", "new", "not", "one", "our", "out", "over", "per", "role", "team",
  "that", "the", "their", "them", "they", "this", "through", "time", "using", "well",
  "what", "when", "where", "which", "while", "will", "with", "work", "working", "would",
  "you", "your", "years", "year",
]);

const INDUSTRY_CATALOG: { label: string; terms: string[] }[] = [
  { label: "Technology / SaaS", terms: ["saas", "software", "tech", "cloud", "platform", "api", "developer"] },
  { label: "Finance / Fintech", terms: ["fintech", "banking", "finance", "payments", "investment", "trading"] },
  { label: "Healthcare", terms: ["healthcare", "health", "clinical", "medical", "pharma", "biotech", "hospital"] },
  { label: "E-commerce / Retail", terms: ["ecommerce", "e-commerce", "retail", "marketplace", "consumer"] },
  { label: "Media / Entertainment", terms: ["media", "entertainment", "streaming", "gaming", "content"] },
  { label: "Education", terms: ["education", "edtech", "learning", "university", "school"] },
  { label: "Government / Public", terms: ["government", "public sector", "federal", "nonprofit", "ngo"] },
];

const SECTION_HEADER =
  /^(?:requirements?|qualifications?|required|preferred|skills?|responsibilities|what you(?:'ll| will) do|what we(?:'re| are) looking for|about (?:the )?role|experience|must have|nice to have)\b[:\s]*$/i;

const BULLET = /^\s*(?:[-•*●▪]|\d+[.)])\s+/;

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
}

function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9+#./-]{2,}/g) || [];
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const t of raw) {
    const term = t.replace(/^\.+|\.+$/g, "");
    if (term.length < 2 || STOP.has(term) || seen.has(term)) continue;
    seen.add(term);
    terms.push(term);
  }
  return terms;
}

/** Pull requirement bullets and comma-separated skill lists from JD text. */
export function extractJobKeywords(description: string, max = 12): string[] {
  const text = normalizeText(description);
  const lines = text.split("\n");
  const priorityChunks: string[] = [];
  let inRelevantSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (SECTION_HEADER.test(line.replace(/[#*:]+$/, "").trim())) {
      inRelevantSection = true;
      continue;
    }

    if (/^[A-Z][A-Za-z\s/&-]{2,40}:?\s*$/.test(line) && line.length < 55 && !BULLET.test(line)) {
      inRelevantSection = SECTION_HEADER.test(line.replace(/:$/, ""));
    }

    const bulletText = line.replace(BULLET, "").trim();
    const chunk = inRelevantSection || BULLET.test(line) ? bulletText : line;

    if (chunk.length >= 8) {
      priorityChunks.push(chunk);
    }

    if (chunk.includes(",")) {
      for (const part of chunk.split(",")) {
        const p = part.trim();
        if (p.length >= 2 && p.length <= 40) priorityChunks.push(p);
      }
    }
  }

  const fromBullets = priorityChunks.flatMap((chunk) => {
    const terms = tokenize(chunk);
    const multi = chunk.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\b/g) || [];
    return [...terms, ...multi.map((m) => m.toLowerCase())];
  });

  const fallbackTerms = tokenize(text);
  const scored = new Map<string, number>();

  for (const term of fromBullets) {
    scored.set(term, (scored.get(term) ?? 0) + 3);
  }
  for (const term of fallbackTerms) {
    scored.set(term, (scored.get(term) ?? 0) + 1);
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([term]) => term)
    .filter((term) => term.length >= 3)
    .slice(0, max);
}

export function extractRequiredYears(description: string): number | null {
  const text = description.toLowerCase();
  const patterns = [
    /(?:minimum|min\.?|at least|require[s]?)\s*(?:of\s*)?(\d+)\+?\s*(?:years?|yrs?)/i,
    /(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:professional|relevant|industry))?\s+experience/i,
    /(\d+)\+?\s*(?:years?|yrs?)\s+(?:in|of)\s+/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return parseInt(m[1], 10);
  }
  return null;
}

/** Estimate total professional years from date ranges in resume text. */
export function estimateResumeYears(resumeText: string): number | null {
  const text = resumeText.toLowerCase();
  const explicit = text.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:experience|exp))?/);
  if (explicit?.[1]) {
    const n = parseInt(explicit[1], 10);
    if (n >= 1 && n <= 45) return n;
  }

  const ranges: { start: number; end: number }[] = [];
  const rangeRe =
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{4})\s*[-–—]\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*)?(\d{4}|present|current|now)/gi;
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(text)) !== null) {
    const start = parseInt(m[1], 10);
    const endRaw = m[2].toLowerCase();
    const end = endRaw === "present" || endRaw === "current" || endRaw === "now"
      ? new Date().getFullYear()
      : parseInt(endRaw, 10);
    if (start >= 1970 && start <= end) ranges.push({ start, end });
  }

  const yearPairRe = /(\d{4})\s*[-–—]\s*(\d{4}|present|current|now)/gi;
  while ((m = yearPairRe.exec(text)) !== null) {
    const start = parseInt(m[1], 10);
    const endRaw = m[2].toLowerCase();
    const end = endRaw === "present" || endRaw === "current" || endRaw === "now"
      ? new Date().getFullYear()
      : parseInt(endRaw, 10);
    if (start >= 1970 && start <= end && end - start <= 30) ranges.push({ start, end });
  }

  if (!ranges.length) return null;

  const sorted = ranges.sort((a, b) => a.start - b.start);
  let total = 0;
  let cursor = 0;
  for (const r of sorted) {
    const from = Math.max(r.start, cursor);
    if (r.end > from) {
      total += r.end - from;
      cursor = r.end;
    }
  }
  return total > 0 ? Math.min(total, 45) : null;
}

export function extractResumeTitle(resumeText: string): string {
  const lines = normalizeText(resumeText)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const titleHints =
    /\b(engineer|developer|manager|director|lead|designer|analyst|consultant|specialist|architect|coordinator|associate|vp|president|head of|product|marketing|sales|operations|recruiter|scientist|administrator)\b/i;

  for (const line of lines.slice(0, 12)) {
    if (line.length > 8 && line.length < 80 && titleHints.test(line) && !/@/.test(line)) {
      return line;
    }
  }

  const expIdx = lines.findIndex((l) => /^experience$/i.test(l) || /^work experience$/i.test(l));
  if (expIdx >= 0) {
    for (const line of lines.slice(expIdx + 1, expIdx + 6)) {
      if (line.length >= 4 && line.length <= 70 && !/^\d{4}/.test(line)) return line;
    }
  }

  return lines[1] ?? lines[0] ?? "Not found";
}

export function compareJobTitles(jobTitle: string, resumeTitle: string): boolean {
  const jobWords = jobTitle
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
  if (!jobWords.length) return true;
  const resumeLower = resumeTitle.toLowerCase();
  const matched = jobWords.filter((w) => resumeLower.includes(w)).length;
  return matched >= Math.ceil(jobWords.length * 0.45);
}

function detectIndustries(text: string): string[] {
  const lower = text.toLowerCase();
  return INDUSTRY_CATALOG.filter(({ terms }) => terms.some((t) => lower.includes(t))).map(
    ({ label }) => label,
  );
}

function formatYears(n: number | null, fallback = "Not specified"): string {
  if (n == null || n <= 0) return fallback;
  return n >= 10 ? `${n}+ years` : `${n} years`;
}

function buildSummaryNote(opts: {
  jobTitleMatch: boolean;
  yoeMatch: boolean;
  industryMatch: boolean;
  matchedKw: number;
  totalKw: number;
  jobTitle: string;
  resumeTitle: string;
}): string {
  const parts: string[] = [];
  if (!opts.jobTitleMatch && opts.jobTitle && opts.resumeTitle) {
    parts.push(`Your headline reads "${opts.resumeTitle}" — the posting title is "${opts.jobTitle}".`);
  }
  if (opts.totalKw >= 3) {
    const pct = Math.round((opts.matchedKw / opts.totalKw) * 100);
    if (pct >= 70) parts.push("Strong keyword overlap with the posting requirements.");
    else if (pct >= 40) parts.push("Partial keyword overlap — several posting terms are missing from your resume.");
    else parts.push("Most key terms from this posting are missing from your resume.");
  }
  if (!opts.yoeMatch) parts.push("Years of experience may be below what the role asks for.");
  else if (opts.yoeMatch) parts.push("Your experience level aligns with the role requirement.");
  if (opts.industryMatch) parts.push("Relevant industry background shows up on your resume.");
  return parts[0] ?? "Compare your summary and skills sections against the posting requirements.";
}

export function computeResumeJobMatch(input: {
  jobTitle: string;
  company?: string;
  description: string;
  resumeText: string;
  excludeTerms?: string[];
}): ResumeJobMatchResult {
  const { jobTitle, description, resumeText } = input;
  const exclude = new Set(
    (input.excludeTerms ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
  );

  const keywordTexts = extractJobKeywords(description).filter((t) => !exclude.has(t));
  const resumeLower = resumeText.toLowerCase();
  const keywords = keywordTexts.map((text) => ({
    text,
    matched: resumeLower.includes(text.toLowerCase()),
  }));

  const matchedKw = keywords.filter((k) => k.matched).length;
  const totalKw = keywords.length;
  const kwRatio = totalKw ? matchedKw / totalKw : 0;

  const resumeTitle = extractResumeTitle(resumeText);
  const jobTitleMatch = compareJobTitles(jobTitle, resumeTitle);

  const requiredYears = extractRequiredYears(description);
  const candidateYears = estimateResumeYears(resumeText);
  const yoeRequired = formatYears(requiredYears);
  const yoeCandidate = formatYears(candidateYears, "Not detected");
  const yoeMatch =
    requiredYears == null || candidateYears == null ? true : candidateYears >= requiredYears;

  const jdIndustries = detectIndustries(description);
  const industrySource = jdIndustries.length
    ? jdIndustries
    : detectIndustries(`${description} ${input.company ?? ""}`);
  const industryTags = industrySource.slice(0, 6).map((label) => {
    const terms = INDUSTRY_CATALOG.find((c) => c.label === label)?.terms ?? [];
    const jdHit = terms.some((t) => description.toLowerCase().includes(t));
    const resumeHit = terms.some((t) => resumeLower.includes(t));
    return { label, matched: jdHit && resumeHit };
  });
  const industries = industryTags.map((t) => t.label);
  const industryMatch =
    industryTags.length === 0 || industryTags.some((t) => t.matched);

  let score = kwRatio * 7;
  if (jobTitleMatch) score += 1.2;
  else score -= 0.8;
  if (yoeMatch) score += 0.8;
  else score -= 0.6;
  if (industryMatch && industries.length) score += 0.5;
  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

  const scoreLabel = labelForScore(score);
  const summaryNote =
    buildSummaryNote({
      jobTitleMatch,
      yoeMatch,
      industryMatch,
      matchedKw,
      totalKw,
      jobTitle,
      resumeTitle,
    }) ||
    usableKeywordSummary(matchedKw, totalKw) ||
    "Review how your summary and recent roles reflect this posting.";

  return {
    score,
    scoreLabel,
    jobTitle,
    resumeTitle,
    jobTitleMatch,
    yoeRequired,
    yoeCandidate,
    yoeMatch,
    industries,
    industryMatch,
    industryTags,
    keywords,
    summaryNote,
    _fallback: true,
  };
}

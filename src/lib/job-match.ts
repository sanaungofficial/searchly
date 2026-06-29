/** Shared role-matching helpers for watchlist job scans. */

const ROLE_STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "lead",
  "head",
  "senior",
  "staff",
  "principal",
  "vice",
  "president",
  "of",
  "and",
]);

export function parseRolesText(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text.split(/[,;\n]+/).map((r) => r.trim()).filter(Boolean);
}

export function buildMatchRoles(profileRoles: string[], companyTargetRoles: string | null): string[] {
  const seen = new Set<string>();
  return [...profileRoles, ...parseRolesText(companyTargetRoles)].filter((role) => {
    const key = role.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Keywords for Hirebase `keywords` filter — broader than full job titles. */
const EXECUTIVE_TITLE_RE =
  /\b(chief|ceo|cfo|cto|cmo|cro|cpo|cio|president|evp|svp|vp|vice president|executive director|managing director|general manager)\b/i;

/** True when the user is explicitly searching for leadership / executive titles. */
export function searchTargetsExecutiveRoles(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (EXECUTIVE_TITLE_RE.test(q)) return true;
  return /\b(director|head of|principal|staff engineer|distinguished)\b/i.test(q);
}

/** Drop C-suite / VP postings when the search phrase targets IC or mid-level roles. */
export function isExecutiveJobTitle(title: string): boolean {
  return EXECUTIVE_TITLE_RE.test(title.trim());
}

/** Build ATS-style title list for Hirebase `/v2/jobs/search` — full phrase first, then comma-separated alts. */
export function buildActiveRoleSearchTitles(query: string, filterJobTitles?: string[]): string[] {
  const fromFilters = (filterJobTitles ?? []).map((t) => t.trim()).filter(Boolean);
  if (fromFilters.length) return fromFilters.slice(0, 20);

  const phrase = query.trim();
  if (!phrase) return [];

  const parts = phrase
    .split(/[,;\n|]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
  if (parts.length > 1) return [...new Set(parts)].slice(0, 10);

  return [phrase];
}

/** Higher score = closer title match to the user's search phrase. */
export function roleSearchRelevanceScore(jobTitle: string, searchRoles: string[]): number {
  const title = jobTitle.trim().toLowerCase();
  if (!title || !searchRoles.length) return 0;

  let best = 0;
  for (const role of searchRoles) {
    const phrase = role.trim().toLowerCase();
    if (!phrase) continue;
    if (title === phrase) {
      best = Math.max(best, 100);
      continue;
    }
    if (phrase.length >= 4 && title.includes(phrase)) {
      best = Math.max(best, 92);
      continue;
    }
    if (isJobMatch(jobTitle, [role])) {
      const words = phrase.split(/\s+/).filter((w) => w.length >= 3 && !ROLE_STOP_WORDS.has(w));
      const matched = words.filter((w) => title.includes(w)).length;
      best = Math.max(best, 55 + Math.round((matched / Math.max(words.length, 1)) * 35));
    }
  }
  return best;
}

export function compareRoleSearchRelevance(
  titleA: string,
  titleB: string,
  searchQuery: string,
  searchRoles?: string[],
): number {
  const roles = searchRoles?.length ? searchRoles : buildActiveRoleSearchTitles(searchQuery);
  const scoreB = roleSearchRelevanceScore(titleB, roles);
  const scoreA = roleSearchRelevanceScore(titleA, roles);
  if (scoreB !== scoreA) return scoreB - scoreA;
  return titleA.localeCompare(titleB);
}

export function roleSearchKeywords(matchRoles: string[]): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const role of matchRoles) {
    const normalized = role.trim().toLowerCase();
    if (normalized.length >= 4 && !seen.has(normalized)) {
      seen.add(normalized);
      keywords.push(normalized);
    }

    for (const word of normalized.split(/\s+/)) {
      const w = word.replace(/[^a-z0-9+#]/g, "");
      if (w.length >= 3 && !ROLE_STOP_WORDS.has(w) && !seen.has(w)) {
        seen.add(w);
        keywords.push(w);
      }
    }
  }

  return keywords.slice(0, 12);
}

export function isJobMatch(
  jobTitle: string,
  matchRoles: string[],
  department?: string | null
): boolean {
  if (!matchRoles.length) return false;
  const haystack = `${jobTitle} ${department ?? ""}`.toLowerCase();

  if (
    matchRoles.some((role) => {
      const phrase = role.trim().toLowerCase();
      return phrase.length >= 4 && haystack.includes(phrase);
    })
  ) {
    return true;
  }

  return matchRoles.some((role) => {
    const words = role
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9+#]/g, ""))
      .filter((w) => w.length >= 3 && !ROLE_STOP_WORDS.has(w));

    if (!words.length) return false;
    return words.some((w) => haystack.includes(w));
  });
}

export function hasMatchRoles(profileRoles: string[], companyTargetRoles: string | null): boolean {
  return buildMatchRoles(profileRoles, companyTargetRoles).length > 0;
}

export function dedupeJobs<T extends { url: string | null; title: string }>(jobs: T[]): T[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = (job.url ?? job.title).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterMatchingJobs<T extends { title: string; department?: string | null; url: string | null }>(
  jobs: T[],
  matchRoles: string[],
  maxJobs: number
): T[] {
  return dedupeJobs(jobs.filter((job) => isJobMatch(job.title, matchRoles, job.department))).slice(0, maxJobs);
}

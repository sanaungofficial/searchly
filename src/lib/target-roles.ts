import { AVAILABLE_ROLES } from "@/components/scout/workspace-data";

/** Legacy bucket titles — kept for suggestion coverage. */
const BUCKET_TITLES = [
  "Product Manager",
  "Senior Product Manager",
  "Principal / Staff Product Manager",
  "Group Product Manager",
  "Director of Product Management",
  "VP of Product",
  "Head of Product",
  "Chief Product Officer (CPO)",
  "Strategy Manager",
  "Senior Strategy Manager",
  "Director of Strategy",
  "VP of Corporate Strategy",
  "Head of Corporate Development",
  "Director of Corporate Development",
  "Chief Strategy Officer (CSO)",
  "Business Development Director",
  "Chief of Staff",
  "Business Operations Manager",
  "Director of Operations",
  "VP of Operations",
  "Chief Operating Officer (COO)",
  "Head of BizOps",
  "General Manager",
  "Director of Program Management",
  "Transformation Director",
  "Operating Partner",
  "Head of Portfolio Operations",
  "Portfolio Operations Manager",
  "Value Creation Manager",
  "Chief of Staff (PE/VC-backed)",
  "VP of Operations (PE-backed)",
];

/** Common titles outside the core ICP list — marketing, data, eng, etc. */
const EXTENDED_TARGET_ROLES = [
  "Marketing Automation Manager",
  "Marketing Manager",
  "Senior Marketing Manager",
  "Director of Marketing",
  "VP of Marketing",
  "Head of Marketing",
  "Growth Marketing Manager",
  "Director of Growth Marketing",
  "Demand Generation Manager",
  "Product Marketing Manager",
  "Senior Product Marketing Manager",
  "Director of Product Marketing",
  "Content Marketing Manager",
  "Brand Marketing Manager",
  "Digital Marketing Manager",
  "Marketing Operations Manager",
  "Revenue Marketing Manager",
  "Customer Success Manager",
  "Director of Customer Success",
  "VP of Customer Success",
  "Account Executive",
  "Senior Account Executive",
  "Sales Manager",
  "Director of Sales",
  "VP of Sales",
  "Business Analyst",
  "Senior Business Analyst",
  "Data Analyst",
  "Senior Data Analyst",
  "Data Scientist",
  "Analytics Manager",
  "Software Engineer",
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Engineering Manager",
  "Director of Engineering",
  "VP of Engineering",
  "Program Manager",
  "Senior Program Manager",
  "Technical Program Manager",
  "Project Manager",
  "Senior Project Manager",
  "Management Consultant",
  "Senior Consultant",
  "Associate",
  "Senior Associate",
  "Finance Manager",
  "Director of Finance",
  "VP of Finance",
  "Controller",
];

function dedupeTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of titles) {
    const title = raw.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
  }
  return out;
}

export const TARGET_ROLE_SUGGESTIONS: string[] = dedupeTitles([
  ...AVAILABLE_ROLES,
  ...BUCKET_TITLES,
  ...EXTENDED_TARGET_ROLES,
]).sort((a, b) => a.localeCompare(b));

/** Score + filter suggestions for typeahead (prefix and word matches rank higher). */
export function filterTargetRoleSuggestions(query: string, limit = 10): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return TARGET_ROLE_SUGGESTIONS.slice(0, Math.min(limit, 14));

  const words = q.split(/\s+/).filter(Boolean);

  const scored = TARGET_ROLE_SUGGESTIONS.map((title) => {
    const lower = title.toLowerCase();
    let score = 0;
    if (lower.startsWith(q)) score += 100;
    else if (lower.includes(q)) score += 60;
    if (words.every((w) => lower.includes(w))) score += 40;
    for (const w of words) {
      if (lower.startsWith(w)) score += 15;
    }
    return { title, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return scored.slice(0, limit).map((x) => x.title);
}

export function mergeRoleSuggestions(
  query: string,
  prioritized: string[],
  limit = 10
): string[] {
  const filtered = filterTargetRoleSuggestions(query, limit);
  const q = query.trim().toLowerCase();
  const prioritizedMatches = prioritized.filter((title) => {
    if (!q) return true;
    return title.toLowerCase().includes(q) || q.split(/\s+/).every((w) => title.toLowerCase().includes(w));
  });

  return dedupeTitles([...prioritizedMatches, ...filtered]).slice(0, limit);
}

export function normalizeCustomRoleTitle(input: string): string | null {
  const title = input.trim().replace(/\s+/g, " ");
  if (title.length < 2 || title.length > 80) return null;
  return title;
}

import { FALLBACK_JOB_CATEGORIES } from "@/lib/hirebase-role-discovery";
import type { WorkArrangementId } from "@/lib/onboarding-preferences";

export type OnelinerSuggestions = {
  targetRoles: string[];
  prioritizedCategories: string[];
  deprioritizedCategories: string[];
  targetMarket: string | null;
  workArrangement: WorkArrangementId | null;
};

export type OnelinerAnalysisResponse = {
  picture: string;
  strengths: string[];
  targetRoles: { role: string; match: string }[];
  prioritizedCategories: string[];
  deprioritizedCategories: string[];
  targetMarket: string | null;
  workArrangement: WorkArrangementId | null;
  source: "ai" | "heuristic";
};

type KeywordRule = {
  keywords: string[];
  categories?: string[];
  roles?: string[];
  avoidCategories?: string[];
};

const RULES: KeywordRule[] = [
  {
    keywords: ["product", "pm ", " pm", "product manager"],
    categories: ["Product Jobs"],
    roles: ["Senior Product Manager", "Director of Product", "Product Lead"],
  },
  {
    keywords: ["engineer", "engineering", "software", "developer", "technical", "swe"],
    categories: ["Engineering Jobs"],
    roles: ["Software Engineer", "Engineering Manager", "Staff Engineer"],
  },
  {
    keywords: ["strategy", "strategic", "consult", "consulting", "transformation", "mba"],
    categories: ["Consulting Jobs", "Operations Jobs"],
    roles: ["Director of Strategy", "Strategy & Operations Lead", "Management Consultant"],
  },
  {
    keywords: ["growth", "gtm", "go-to-market", "revenue", "revops"],
    categories: ["Business Development Jobs", "Marketing Jobs"],
    roles: ["Head of Growth", "GTM Operations Lead", "Revenue Operations Manager"],
  },
  {
    keywords: ["operations", " ops", "ops ", "program", "project"],
    categories: ["Operations Jobs", "Project Management Jobs"],
    roles: ["Director of Operations", "Program Manager", "Chief of Staff"],
  },
  {
    keywords: ["marketing", "brand", "content", "demand gen"],
    categories: ["Marketing Jobs"],
    roles: ["Marketing Manager", "Head of Marketing", "Growth Marketing Lead"],
  },
  {
    keywords: ["finance", "fp&a", "financial", "investment", "banking"],
    categories: ["Finance Jobs"],
    roles: ["Finance Manager", "Director of Finance", "FP&A Lead"],
  },
  {
    keywords: ["sales", "account executive", " ae", "business development", "bd "],
    categories: ["Sales Jobs", "Business Development Jobs"],
    roles: ["Account Executive", "Business Development Manager", "Sales Director"],
  },
  {
    keywords: ["data", "analytics", "analyst", "machine learning", " ml"],
    categories: ["Data Jobs"],
    roles: ["Data Analyst", "Analytics Manager", "Data Science Lead"],
  },
  {
    keywords: ["design", "ux", "ui", "creative"],
    categories: ["Design Jobs"],
    roles: ["Product Designer", "UX Lead", "Design Manager"],
  },
  {
    keywords: ["customer success", "cs ", " cs", "support"],
    categories: ["Customer Success Jobs"],
    roles: ["Customer Success Manager", "Director of Customer Success"],
  },
  {
    keywords: ["hr", "people", "talent", "recruiting"],
    categories: ["Human Resources Jobs"],
    roles: ["People Operations Manager", "Talent Acquisition Lead"],
  },
  {
    keywords: ["legal", "counsel", "compliance"],
    categories: ["Legal Jobs"],
    roles: ["Corporate Counsel", "Compliance Manager"],
  },
];

const AVOID_PATTERNS: { pattern: RegExp; categories: string[] }[] = [
  { pattern: /\b(not|no|avoid|never|don't|dont)\b[^.|]{0,40}\bsales\b/i, categories: ["Sales Jobs"] },
  { pattern: /\b(not|no|avoid|never|don't|dont)\b[^.|]{0,40}\bengineer/i, categories: ["Engineering Jobs"] },
  { pattern: /\b(not|no|avoid|never|don't|dont)\b[^.|]{0,40}\bproduct\b/i, categories: ["Product Jobs"] },
  { pattern: /\b(not|no|avoid|never|don't|dont)\b[^.|]{0,40}\bmarketing\b/i, categories: ["Marketing Jobs"] },
  { pattern: /\b(not|no|avoid|never|don't|dont)\b[^.|]{0,40}\bcustomer success\b/i, categories: ["Customer Success Jobs"] },
];

const LOCATION_PATTERNS = [
  /\b(?:based in|located in|living in|from)\s+([A-Za-z][A-Za-z\s.,-]{2,40})/i,
  /\b(?:in|@)\s+(San Francisco|New York|Los Angeles|Chicago|Boston|Seattle|Austin|Denver|Atlanta|Miami|London|Toronto|Vancouver|Sydney|Singapore|Berlin|Paris)\b/i,
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueStrings(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

function matchCategories(text: string): string[] {
  const pool = FALLBACK_JOB_CATEGORIES;
  const matched: string[] = [];
  for (const rule of RULES) {
    if (!rule.keywords.some((kw) => text.includes(kw))) continue;
    for (const cat of rule.categories ?? []) {
      if (pool.some((p) => p.toLowerCase() === cat.toLowerCase())) matched.push(cat);
    }
  }
  for (const cat of pool) {
    const stem = cat.replace(/\s+Jobs$/i, "").toLowerCase();
    if (stem.length > 3 && text.includes(stem)) matched.push(cat);
  }
  return uniqueStrings(matched, 5);
}

function matchRoles(text: string): string[] {
  const matched: string[] = [];
  for (const rule of RULES) {
    if (!rule.keywords.some((kw) => text.includes(kw))) continue;
    matched.push(...(rule.roles ?? []));
  }
  if (matched.length === 0) {
    matched.push("Senior Product Manager", "Director of Strategy", "Head of Operations");
  }
  return uniqueStrings(matched, 8);
}

function matchAvoidCategories(text: string, prioritized: string[]): string[] {
  const matched: string[] = [];
  for (const { pattern, categories } of AVOID_PATTERNS) {
    if (pattern.test(text)) matched.push(...categories);
  }
  const prioritizedLower = new Set(prioritized.map((c) => c.toLowerCase()));
  return uniqueStrings(
    matched.filter((c) => !prioritizedLower.has(c.toLowerCase())),
    5,
  );
}

function inferLocation(raw: string): string | null {
  for (const pattern of LOCATION_PATTERNS) {
    const match = raw.match(pattern);
    if (!match) continue;
    const value = (match[1] ?? match[0]).replace(/\s+/g, " ").trim().replace(/[.,]$/, "");
    if (value.length >= 3 && value.length <= 60) return value;
  }
  return null;
}

function inferWorkArrangement(text: string): WorkArrangementId | null {
  if (/\b(remote[- ]?only|fully remote|100% remote)\b/i.test(text)) return "remote_only";
  if (/\bremote\b/i.test(text)) return "remote_only";
  if (/\bhybrid\b/i.test(text)) return "hybrid_ok";
  if (/\bon[- ]?site\b/i.test(text)) return "onsite_ok";
  return null;
}

/** Client-safe heuristic suggestions from a profile one-liner / pitch. */
export function suggestFromOneliner(raw: string): OnelinerSuggestions {
  const text = normalizeText(raw);
  const prioritizedCategories = matchCategories(text);
  const deprioritizedCategories = matchAvoidCategories(raw, prioritizedCategories);
  return {
    targetRoles: matchRoles(text),
    prioritizedCategories,
    deprioritizedCategories,
    targetMarket: inferLocation(raw),
    workArrangement: inferWorkArrangement(text),
  };
}

export function mergeOnelinerSuggestions(
  ai: Partial<OnelinerSuggestions> | null | undefined,
  heuristic: OnelinerSuggestions,
): OnelinerSuggestions {
  return {
    targetRoles: uniqueStrings([...(ai?.targetRoles ?? []), ...heuristic.targetRoles], 8),
    prioritizedCategories: uniqueStrings(
      [...(ai?.prioritizedCategories ?? []), ...heuristic.prioritizedCategories],
      5,
    ),
    deprioritizedCategories: uniqueStrings(
      [...(ai?.deprioritizedCategories ?? []), ...heuristic.deprioritizedCategories],
      5,
    ),
    targetMarket: ai?.targetMarket?.trim() || heuristic.targetMarket,
    workArrangement: ai?.workArrangement ?? heuristic.workArrangement,
  };
}

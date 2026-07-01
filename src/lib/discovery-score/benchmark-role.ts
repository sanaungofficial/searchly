import { displayJobFunctionLabel } from "@/lib/job-function-groups";
import type { DiscoveryProfileContext } from "./types";
import { DISCOVERY_BENCHMARK_CATEGORY_KEY } from "./constants";

export type DiscoveryBenchmarkResolution = {
  targetRoleLabel: string;
  hirebaseCategory: string | null;
  sumbleJobFunction: string | null;
  sumbleJobLevel: string | null;
  titleTokens: string[];
  source: "override" | "prioritized_category" | "role_inferred" | "target_role_only";
};

/** Hirebase category label (without " Jobs") → Sumble people-search job_function value. */
const HIREBASE_TO_SUMBLE_JOB_FUNCTION: Record<string, string> = {
  engineering: "Engineering",
  product: "Product",
  marketing: "Marketing",
  sales: "Sales",
  design: "Design",
  data: "Data",
  finance: "Finance",
  accounting: "Finance",
  operations: "Operations",
  "human resources": "Human Resources",
  recruiting: "Human Resources",
  "customer success": "Customer Success",
  "customer support": "Customer Support",
  support: "Customer Support",
  "business development": "Business Development",
  consulting: "Consulting",
  legal: "Legal",
  "project management": "Project Management",
  administrative: "Administrative",
  arts: "Arts",
  creative: "Creative",
  entertainment: "Entertainment",
  education: "Education",
  content: "Marketing",
  communications: "Marketing",
  software: "Engineering",
  internet: "Engineering",
  ai: "Engineering",
};

const ROLE_KEYWORD_TO_JOB_FUNCTION: Array<{ pattern: RegExp; jobFunction: string }> = [
  { pattern: /\b(dance|choreograph|performing|theater|theatre|ballet|arts)\b/i, jobFunction: "Arts" },
  { pattern: /\b(educat|teacher|professor|school|curriculum|student|academic)\b/i, jobFunction: "Education" },
  { pattern: /\b(nurse|clinical|physician|medical|healthcare|hospital)\b/i, jobFunction: "Healthcare" },
  { pattern: /\b(engineer|developer|software|devops|sre|platform)\b/i, jobFunction: "Engineering" },
  { pattern: /\b(product manager|product management|\bpm\b)\b/i, jobFunction: "Product" },
  { pattern: /\b(marketing|brand|growth|content|communications)\b/i, jobFunction: "Marketing" },
  { pattern: /\b(sales|account executive|business development|\bbd\b)\b/i, jobFunction: "Sales" },
  { pattern: /\b(design|ux|ui|creative director)\b/i, jobFunction: "Design" },
  { pattern: /\b(data scientist|analytics|machine learning|\bml\b)\b/i, jobFunction: "Data" },
  { pattern: /\b(finance|accounting|controller|fp&a)\b/i, jobFunction: "Finance" },
  { pattern: /\b(human resources|\bhr\b|recruit|talent)\b/i, jobFunction: "Human Resources" },
  { pattern: /\b(operations|supply chain|logistics)\b/i, jobFunction: "Operations" },
  { pattern: /\b(legal|counsel|compliance)\b/i, jobFunction: "Legal" },
  { pattern: /\b(consultant|consulting|strategy)\b/i, jobFunction: "Consulting" },
  { pattern: /\b(customer success|client success)\b/i, jobFunction: "Customer Success" },
];

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "program",
]);

const NICHE_TITLE_WORDS = new Set([
  "dance",
  "ballet",
  "theater",
  "theatre",
  "music",
  "yoga",
  "fitness",
  "sports",
  "baseball",
  "football",
  "soccer",
]);

function normalizeCategoryKey(category: string): string {
  return displayJobFunctionLabel(category).trim().toLowerCase();
}

export function hirebaseCategoryToSumbleJobFunction(category: string): string | null {
  const key = normalizeCategoryKey(category);
  if (!key) return null;
  if (HIREBASE_TO_SUMBLE_JOB_FUNCTION[key]) return HIREBASE_TO_SUMBLE_JOB_FUNCTION[key];
  const withoutJobs = key.replace(/\s+jobs$/i, "").trim();
  return HIREBASE_TO_SUMBLE_JOB_FUNCTION[withoutJobs] ?? null;
}

export function inferSumbleJobFunctionFromRole(role: string): string | null {
  for (const rule of ROLE_KEYWORD_TO_JOB_FUNCTION) {
    if (rule.pattern.test(role)) return rule.jobFunction;
  }
  return null;
}

export function inferSumbleJobLevel(role: string): string | null {
  const lower = role.toLowerCase();
  if (/\b(chief|c-suite|ceo|cto|cfo|coo|cmo)\b/.test(lower)) return "C-Suite";
  if (/\b(vp|vice president|svp|evp)\b/.test(lower)) return "VP";
  if (/\b(director|head of)\b/.test(lower)) return "Director";
  if (/\b(manager|lead|supervisor)\b/.test(lower)) return "Manager";
  return null;
}

/** Generic title fragments for Sumble job_title CONTAINS — skips niche domain words. */
export function titleTokensForBenchmark(role: string): string[] {
  const tokens = role
    .replace(/[^a-zA-Z0-9+#\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !TITLE_STOP_WORDS.has(t.toLowerCase()) && !NICHE_TITLE_WORDS.has(t.toLowerCase()));

  const phrases: string[] = [];
  if (tokens.length >= 2) {
    phrases.push(tokens.slice(-2).join(" "));
  }
  if (tokens.length >= 3) {
    phrases.push(tokens.slice(-3).join(" "));
  }
  for (const token of tokens) {
    if (/director|manager|lead|head|president|vp|chief/i.test(token)) {
      phrases.push(token);
    }
  }

  return [...new Set(phrases.map((p) => p.trim()).filter(Boolean))].slice(0, 4);
}

export function readDiscoveryBenchmarkCategoryOverride(parsedData: unknown): string | null {
  if (!parsedData || typeof parsedData !== "object") return null;
  const raw = (parsedData as Record<string, unknown>)[DISCOVERY_BENCHMARK_CATEGORY_KEY];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function resolveDiscoveryBenchmark(ctx: DiscoveryProfileContext): DiscoveryBenchmarkResolution {
  const roles = ctx.prioritizedRoles.length ? ctx.prioritizedRoles : ctx.targetRoles;
  const targetRoleLabel = roles[0]?.trim() || ctx.headline?.trim() || "similar roles";
  const override = ctx.benchmarkCategoryOverride?.trim() || null;

  if (override) {
    return {
      targetRoleLabel,
      hirebaseCategory: override,
      sumbleJobFunction: hirebaseCategoryToSumbleJobFunction(override),
      sumbleJobLevel: inferSumbleJobLevel(targetRoleLabel),
      titleTokens: titleTokensForBenchmark(targetRoleLabel),
      source: "override",
    };
  }

  const prioritizedCategory = ctx.prioritizedCategories.find((c) => c.trim())?.trim() ?? null;
  if (prioritizedCategory) {
    return {
      targetRoleLabel,
      hirebaseCategory: prioritizedCategory,
      sumbleJobFunction: hirebaseCategoryToSumbleJobFunction(prioritizedCategory),
      sumbleJobLevel: inferSumbleJobLevel(targetRoleLabel),
      titleTokens: titleTokensForBenchmark(targetRoleLabel),
      source: "prioritized_category",
    };
  }

  const inferred = inferSumbleJobFunctionFromRole(targetRoleLabel);
  if (inferred) {
    return {
      targetRoleLabel,
      hirebaseCategory: null,
      sumbleJobFunction: inferred,
      sumbleJobLevel: inferSumbleJobLevel(targetRoleLabel),
      titleTokens: titleTokensForBenchmark(targetRoleLabel),
      source: "role_inferred",
    };
  }

  return {
    targetRoleLabel,
    hirebaseCategory: null,
    sumbleJobFunction: null,
    sumbleJobLevel: inferSumbleJobLevel(targetRoleLabel),
    titleTokens: titleTokensForBenchmark(targetRoleLabel),
    source: "target_role_only",
  };
}

export function benchmarkPeerLabel(resolution: DiscoveryBenchmarkResolution): string {
  if (resolution.hirebaseCategory) {
    return displayJobFunctionLabel(resolution.hirebaseCategory);
  }
  if (resolution.sumbleJobFunction) {
    return resolution.sumbleJobFunction;
  }
  return resolution.targetRoleLabel;
}

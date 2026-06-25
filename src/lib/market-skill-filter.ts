import type { InsightsKeyCount } from "@/lib/market-trends-types";

const GENERIC_SKILL_KEYS = new Set([
  "microsoft excel",
  "microsoft office",
  "microsoft powerpoint",
  "microsoft word",
  "microsoft teams",
  "google docs",
  "google sheets",
  "communication",
  "communication skills",
  "teamwork",
  "leadership",
  "problem solving",
  "time management",
  "attention to detail",
]);

export function isGenericMarketSkill(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return true;
  if (GENERIC_SKILL_KEYS.has(normalized)) return true;
  if (/^microsoft\s+(office|365)/i.test(key)) return true;
  return false;
}

export function filterMarketSkills(items: InsightsKeyCount[], limit = 12): InsightsKeyCount[] {
  return items.filter((item) => !isGenericMarketSkill(item.key)).slice(0, limit);
}

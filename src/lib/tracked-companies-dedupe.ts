import { normalizeCompanySlug } from "@/lib/company-catalog";

type DedupeRow = {
  id: string;
  name: string;
  companyIntelId?: string | null;
};

/** Keep the first row per intel slug or normalized name (caller should pass newest-first). */
export function dedupeTrackedCompanies<T extends DedupeRow>(companies: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of companies) {
    const key = row.companyIntelId
      ? `intel:${row.companyIntelId}`
      : `name:${normalizeCompanySlug(row.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

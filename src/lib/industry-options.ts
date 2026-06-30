import {
  fetchHirebaseIndustryList,
  fetchHirebaseSubindustryList,
  type HirebaseIndustryOption,
} from "@/lib/hirebase";

export type FlatIndustryOption = HirebaseIndustryOption;

let cachedFlatOptions: FlatIndustryOption[] | null = null;
let cacheExpiresAt = 0;
const CACHE_MS = 1000 * 60 * 60 * 6;

export async function loadFlatIndustryOptions(): Promise<FlatIndustryOption[]> {
  if (cachedFlatOptions && Date.now() < cacheExpiresAt) return cachedFlatOptions;
  const [industries, subindustries] = await Promise.all([
    fetchHirebaseIndustryList(),
    fetchHirebaseSubindustryList(),
  ]);
  const byLabel = new Map<string, FlatIndustryOption>();
  for (const opt of industries) {
    byLabel.set(opt.label.toLowerCase(), opt);
  }
  for (const opt of subindustries) {
    byLabel.set(opt.label.toLowerCase(), opt);
  }
  cachedFlatOptions = [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label));
  cacheExpiresAt = Date.now() + CACHE_MS;
  return cachedFlatOptions;
}

/** Split flat UI selections into Hirebase industry vs subindustry arrays. */
export function splitIndustrySelections(
  selections: string[],
  catalog: FlatIndustryOption[],
): { industries: string[]; subindustries: string[] } {
  const byLabel = new Map(catalog.map((o) => [o.label.toLowerCase(), o]));
  const industries = new Set<string>();
  const subindustries = new Set<string>();

  for (const raw of selections) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const match = byLabel.get(trimmed.toLowerCase());
    if (match?.kind === "subindustry") {
      subindustries.add(match.value);
    } else if (match?.kind === "industry") {
      industries.add(match.value);
    } else {
      industries.add(trimmed);
    }
  }

  return {
    industries: [...industries],
    subindustries: [...subindustries],
  };
}

export function filterIndustryOptions(options: FlatIndustryOption[], query: string, limit = 12): FlatIndustryOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice(0, limit);
  return options
    .filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    .slice(0, limit);
}

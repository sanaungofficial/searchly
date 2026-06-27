import {
  RECOMMENDED_EXPANDED_ROLE_CACHE_MS,
  RECOMMENDED_EXPANDED_ROLE_MAX_SEEDS,
} from "@/lib/recommended-jobs-config";
import { expandHirebaseRelatedRoleTitles } from "@/lib/hirebase-role-discovery";
import { profileRoleTitlesForMatch, type RoleTitlePreferences } from "@/lib/role-title-preferences";

const expandedRoleCache = new Map<string, { at: number; titles: string[] }>();

function cacheKey(userId: string, seeds: string[]): string {
  return `${userId}:${seeds.map((s) => s.trim().toLowerCase()).sort().join("|")}`;
}

/** Expand target/prioritized titles into related role families — cached per user. */
export async function resolveExpandedRoleTitles(input: {
  roleTitlePreferences: RoleTitlePreferences;
  userId: string;
  maxSeeds?: number;
}): Promise<string[]> {
  const seeds = profileRoleTitlesForMatch(input.roleTitlePreferences).slice(
    0,
    input.maxSeeds ?? RECOMMENDED_EXPANDED_ROLE_MAX_SEEDS,
  );
  if (!seeds.length) return [];

  const key = cacheKey(input.userId, seeds);
  const cached = expandedRoleCache.get(key);
  const now = Date.now();
  if (cached && now - cached.at < RECOMMENDED_EXPANDED_ROLE_CACHE_MS) {
    return cached.titles;
  }

  const merged = new Set<string>();
  for (const seed of seeds) {
    merged.add(seed.trim());
    try {
      const related = await expandHirebaseRelatedRoleTitles({
        seedTitle: seed,
        limit: 8,
        userId: input.userId,
      });
      for (const suggestion of related) {
        if (suggestion.title.trim()) merged.add(suggestion.title.trim());
      }
    } catch {
      continue;
    }
  }

  const titles = [...merged].slice(0, 24);
  expandedRoleCache.set(key, { at: now, titles });
  return titles;
}

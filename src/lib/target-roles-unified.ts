/** Dedupe role strings case-insensitively while preserving first-seen order. */
export function dedupeRolesPreserveOrder(roles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const role of roles) {
    const trimmed = role.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export type LegacyRoleFields = {
  targetRoles?: string[] | null;
  prioritizedRoles?: string[] | null;
};

/**
 * Single ordered list: legacy prioritized roles first, then target roles.
 * Used for search, ranking, Upskill grouping, and Discovery labels.
 */
export function unifiedTargetRoles(input: LegacyRoleFields): string[] {
  const prioritized = input.prioritizedRoles ?? [];
  const targets = input.targetRoles ?? [];
  return dedupeRolesPreserveOrder([...prioritized, ...targets]);
}

/** Merge legacy prioritizedRoles into targetRoles and clear the deprecated field. */
export function migrateLegacyRoleFields(input: LegacyRoleFields): {
  targetRoles: string[];
  prioritizedRoles: string[];
  migrated: boolean;
} {
  const legacyPrioritized = (input.prioritizedRoles ?? []).map((r) => r.trim()).filter(Boolean);
  if (!legacyPrioritized.length) {
    return {
      targetRoles: dedupeRolesPreserveOrder(input.targetRoles ?? []),
      prioritizedRoles: [],
      migrated: false,
    };
  }

  const merged = unifiedTargetRoles(input);
  const existingTargets = dedupeRolesPreserveOrder(input.targetRoles ?? []);
  const migrated =
    merged.length !== existingTargets.length ||
    merged.some((role, i) => role.toLowerCase() !== (existingTargets[i] ?? "").toLowerCase()) ||
    legacyPrioritized.length > 0;

  return {
    targetRoles: merged,
    prioritizedRoles: [],
    migrated,
  };
}

export function primaryTargetRole(roles: string[] | null | undefined): string | undefined {
  const unified = dedupeRolesPreserveOrder(roles ?? []);
  return unified[0];
}

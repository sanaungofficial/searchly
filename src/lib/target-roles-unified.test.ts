import { describe, expect, it } from "vitest";
import {
  dedupeRolesPreserveOrder,
  migrateLegacyRoleFields,
  unifiedTargetRoles,
} from "./target-roles-unified";
import {
  PRIORITIZED_ROLE_TITLE_BOOST,
  TARGET_ROLE_TITLE_BOOST,
  targetRoleBoostForIndex,
} from "./role-title-preferences";

describe("unifiedTargetRoles", () => {
  it("places prioritized roles before targets and dedupes", () => {
    expect(
      unifiedTargetRoles({
        prioritizedRoles: ["GTM Ops", "RevOps"],
        targetRoles: ["Director of Strategy", "gtm ops"],
      }),
    ).toEqual(["GTM Ops", "RevOps", "Director of Strategy"]);
  });

  it("migrates legacy prioritized into targetRoles", () => {
    const result = migrateLegacyRoleFields({
      prioritizedRoles: ["Commercial Product Lead"],
      targetRoles: ["Director of Strategy"],
    });
    expect(result.migrated).toBe(true);
    expect(result.targetRoles).toEqual(["Commercial Product Lead", "Director of Strategy"]);
    expect(result.prioritizedRoles).toEqual([]);
  });

  it("dedupes case-insensitively", () => {
    expect(dedupeRolesPreserveOrder(["PM", "pm", "Product Manager"])).toEqual(["PM", "Product Manager"]);
  });
});

describe("targetRoleBoostForIndex", () => {
  it("gives strongest boost to first role", () => {
    expect(targetRoleBoostForIndex(0)).toBe(PRIORITIZED_ROLE_TITLE_BOOST);
    expect(targetRoleBoostForIndex(3)).toBe(TARGET_ROLE_TITLE_BOOST);
    expect(targetRoleBoostForIndex(0)).toBeGreaterThan(targetRoleBoostForIndex(3));
  });
});

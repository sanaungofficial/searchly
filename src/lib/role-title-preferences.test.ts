import { describe, expect, it } from "vitest";
import {
  adjustMatchScoreForRoleTitlePreferences,
  jobCategoryMatchesPattern,
  jobTitleMatchesRolePattern,
  PRIORITIZED_ROLE_TITLE_BOOST,
  TARGET_ROLE_TITLE_BOOST,
} from "./role-title-preferences";

describe("jobTitleMatchesRolePattern", () => {
  it("matches exact deprioritized phrases", () => {
    expect(jobTitleMatchesRolePattern("Senior Account Executive", "Account Executive")).toBe(true);
  });

  it("matches product manager family against product management titles", () => {
    expect(
      jobTitleMatchesRolePattern(
        "Director, Product Management - Next Gen Platform",
        "Product Manager",
      ),
    ).toBe(true);
    expect(
      jobTitleMatchesRolePattern("Director of Product Management, Financial Platform", "Product Manager"),
    ).toBe(true);
  });

  it("does not match commercial product lead when deprioritizing product manager", () => {
    expect(jobTitleMatchesRolePattern("Commercial Product Lead", "Product Manager")).toBe(false);
  });

  it("applies penalty for product management when product manager is deprioritized", () => {
    const { netAdjustment, deprioritizedMatch } = adjustMatchScoreForRoleTitlePreferences(
      "Director, Product Management - Next Gen Platform",
      { deprioritizedRoles: ["Product Manager"] },
    );
    expect(deprioritizedMatch).toBe("Product Manager");
    expect(netAdjustment).toBeLessThan(0);
  });
});

describe("prioritized roles and categories", () => {
  it("prioritized role boost beats target role boost", () => {
    const { boost, prioritizedMatch, preferredMatch } = adjustMatchScoreForRoleTitlePreferences(
      "Commercial Product Lead",
      {
        targetRoles: ["Commercial Product Lead"],
        prioritizedRoles: ["Commercial Product Lead"],
      },
    );
    expect(boost).toBe(PRIORITIZED_ROLE_TITLE_BOOST);
    expect(prioritizedMatch).toBe("Commercial Product Lead");
    expect(preferredMatch).toBe("Commercial Product Lead");
    expect(PRIORITIZED_ROLE_TITLE_BOOST).toBeGreaterThan(TARGET_ROLE_TITLE_BOOST);
  });

  it("matches hirebase category buckets", () => {
    expect(jobCategoryMatchesPattern(["Sales Jobs", "Full Time"], "Sales Jobs")).toBe(true);
    expect(jobCategoryMatchesPattern(["Product Jobs"], "Sales Jobs")).toBe(false);
  });

  it("applies category deprioritize penalty", () => {
    const { netAdjustment, deprioritizedCategoryMatch } = adjustMatchScoreForRoleTitlePreferences(
      "Account Executive",
      { deprioritizedCategories: ["Sales Jobs"] },
      ["Sales Jobs"],
    );
    expect(deprioritizedCategoryMatch).toBe("Sales Jobs");
    expect(netAdjustment).toBeLessThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { adjustMatchScoreForRoleTitlePreferences, jobTitleMatchesRolePattern } from "./role-title-preferences";

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

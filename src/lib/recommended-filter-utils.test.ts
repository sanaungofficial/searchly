import { describe, expect, it } from "vitest";
import {
  describeActiveFilters,
  explicitExperienceLevelsFromProfile,
  profileDerivedSearchFilters,
} from "./recommended-filter-utils";

describe("explicitExperienceLevelsFromProfile", () => {
  it("returns undefined when empty", () => {
    expect(explicitExperienceLevelsFromProfile(null)).toBeUndefined();
    expect(explicitExperienceLevelsFromProfile("")).toBeUndefined();
  });

  it("maps exact Hirebase levels only", () => {
    expect(explicitExperienceLevelsFromProfile("Senior")).toEqual(["Senior"]);
    expect(explicitExperienceLevelsFromProfile("senior")).toEqual(["Senior"]);
  });

  it("does not infer from VP or director titles", () => {
    expect(explicitExperienceLevelsFromProfile("VP")).toBeUndefined();
    expect(explicitExperienceLevelsFromProfile("Executive")).toEqual(["Executive"]);
  });
});

describe("profileDerivedSearchFilters", () => {
  it("does not default job type to Full Time when target roles exist", () => {
    const filters = profileDerivedSearchFilters({
      targetRoles: ["VP of Product"],
      employmentStatus: "searching",
    });
    expect(filters.jobTypes).toBeUndefined();
    expect(filters.experienceLevels).toBeUndefined();
  });

  it("pre-selects explicit profile fields only", () => {
    const filters = profileDerivedSearchFilters({
      profileLocation: "Chicago, IL, United States",
      targetRoles: ["Product Manager"],
      prioritizedCategories: ["Operations Jobs"],
      priorities: ["Remote-first"],
      employmentStatus: "searching",
      experienceLevel: "Senior",
    });

    expect(filters.jobTitles).toEqual(["Product Manager"]);
    expect(filters.jobCategories).toEqual(["Operations Jobs"]);
    expect(filters.locationTypes).toEqual(["Remote"]);
    expect(filters.experienceLevels).toEqual(["Senior"]);
    expect(filters.jobTypes).toBeUndefined();
    expect(filters.locations?.[0]?.country).toBe("United States");
  });

  it("maps contract preference from employment status text", () => {
    const filters = profileDerivedSearchFilters({
      employmentStatus: "Freelance / contract",
    });
    expect(filters.jobTypes).toEqual(["Contract"]);
  });

  it("describeActiveFilters omits unset dimensions", () => {
    const filters = profileDerivedSearchFilters({ targetRoles: ["Engineer"] });
    const labels = describeActiveFilters(filters);
    expect(labels.some((l) => l.startsWith("Type:"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Level:"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Titles:"))).toBe(true);
  });
});

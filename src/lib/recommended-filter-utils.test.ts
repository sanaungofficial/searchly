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

  it("pre-selects explicit onboarding/profile fields only", () => {
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
    expect(filters.experienceLevels).toEqual(["Senior"]);
    expect(filters.jobTypes).toBeUndefined();
    expect(filters.locationTypes).toBeUndefined();
    expect(filters.visaSponsored).toBeUndefined();
    expect(filters.salaryFrom).toBeUndefined();
    expect(filters.locations?.[0]?.country).toBe("United States");
    expect(filters.locationRadiusMiles).toBeUndefined();
  });

  it("does not infer contract job type from employment status", () => {
    const filters = profileDerivedSearchFilters({
      employmentStatus: "Freelance / contract",
    });
    expect(filters.jobTypes).toBeUndefined();
  });

  it("describeActiveFilters omits unset dimensions", () => {
    const filters = profileDerivedSearchFilters({ targetRoles: ["Engineer"] });
    const labels = describeActiveFilters(filters);
    expect(labels.some((l) => l.startsWith("Type:"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Level:"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Titles:"))).toBe(true);
  });

  it("country-wide location omits city and region when locationAllInCountry is set", () => {
    const filters = profileDerivedSearchFilters({
      profileLocation: "Baltimore, Maryland, United States",
      searchPreferences: { locationAllInCountry: true },
    });
    expect(filters.locations).toEqual([{ country: "United States" }]);
  });
});

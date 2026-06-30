import { describe, expect, it } from "vitest";
import {
  describeActiveFilters,
  defaultLocationAllInCountry,
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
    expect(filters.jobTitles).toBeUndefined();
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

    expect(filters.jobTitles).toBeUndefined();
    expect(filters.jobCategories).toEqual(["Operations Jobs"]);
    expect(filters.experienceLevels).toEqual(["Senior"]);
    expect(filters.jobTypes).toBeUndefined();
    expect(filters.locationTypes).toBeUndefined();
    expect(filters.visaSponsored).toBeUndefined();
    expect(filters.salaryFrom).toBeUndefined();
    expect(filters.locations?.[0]?.country).toBe("United States");
    expect(filters.locations?.[0]?.city).toBeUndefined();
    expect(filters.locations?.[0]?.region).toBeUndefined();
    expect(filters.locationRadiusMiles).toBeUndefined();
  });

  it("does not infer contract job type from employment status", () => {
    const filters = profileDerivedSearchFilters({
      employmentStatus: "Freelance / contract",
    });
    expect(filters.jobTypes).toBeUndefined();
  });

  it("describeActiveFilters omits unset dimensions", () => {
    const filters = profileDerivedSearchFilters({ prioritizedCategories: ["Engineering Jobs"] });
    const labels = describeActiveFilters(filters);
    expect(labels.some((l) => l.startsWith("Type:"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Level:"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Titles:"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Categories:"))).toBe(true);
  });

  it("country-wide location omits city and region when locationAllInCountry is set", () => {
    const filters = profileDerivedSearchFilters({
      profileLocation: "Baltimore, Maryland, United States",
      searchPreferences: { locationAllInCountry: true },
    });
    expect(filters.locations).toEqual([{ country: "United States", city: undefined, region: undefined }]);
  });

  it("never pre-fills profile city into search location", () => {
    const filters = profileDerivedSearchFilters({
      profileLocation: "Baltimore, Maryland, United States",
    });
    expect(filters.locations?.[0]?.city).toBeUndefined();
    expect(filters.locations?.[0]?.region).toBeUndefined();
    expect(filters.locations?.[0]?.country).toBe("United States");
  });

  it("defaultLocationAllInCountry defaults true when country present", () => {
    expect(defaultLocationAllInCountry(undefined, "United States")).toBe(true);
    expect(defaultLocationAllInCountry({ locationAllInCountry: false }, "United States")).toBe(false);
  });
});

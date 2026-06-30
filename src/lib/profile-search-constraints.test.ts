import { describe, expect, it } from "vitest";
import {
  defaultJobTypesFromProfile,
  locationTypesFromPriorities,
  profileSearchConstraints,
  validateMandatorySearchFilters,
} from "./profile-search-constraints";

describe("locationTypesFromPriorities", () => {
  it("maps remote and hybrid priorities", () => {
    expect(locationTypesFromPriorities(["Remote-first", "Hybrid-friendly"])).toEqual([
      "Remote",
      "Hybrid",
    ]);
  });

  it("defaults to all work models when unset", () => {
    expect(locationTypesFromPriorities([])).toEqual(["Remote", "Hybrid", "In-Person"]);
  });
});

describe("defaultJobTypesFromProfile", () => {
  it("includes all four Hirebase job types", () => {
    expect(defaultJobTypesFromProfile()).toEqual([
      "Full Time",
      "Part Time",
      "Contract",
      "Internship",
    ]);
  });
});

describe("profileSearchConstraints", () => {
  it("builds canonical profile filters with defaults", () => {
    const filters = profileSearchConstraints({
      profileLocation: "Chicago, IL, United States",
      prioritizedCategories: ["Engineering Jobs"],
      priorities: ["Remote-first"],
      experienceLevel: "Senior",
    });

    expect(filters.jobCategories).toEqual(["Engineering Jobs"]);
    expect(filters.experienceLevels).toEqual(["Senior"]);
    expect(filters.jobTypes).toEqual(defaultJobTypesFromProfile());
    expect(filters.locationTypes).toEqual(["Remote"]);
    expect(filters.locations?.[0]?.country).toBe("United States");
  });
});

describe("validateMandatorySearchFilters", () => {
  it("temporarily allows all filter combinations", () => {
    expect(validateMandatorySearchFilters({}).valid).toBe(true);
    expect(validateMandatorySearchFilters({}).missing).toEqual([]);
  });
});

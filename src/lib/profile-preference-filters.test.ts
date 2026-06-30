import { describe, expect, it } from "vitest";
import {
  hasHardRestrictiveListingFilters,
  hasRestrictiveListingFilters,
  hasSoftRestrictiveListingFilters,
  relaxRestrictiveFilters,
  relaxSoftListingFilters,
} from "./profile-preference-filters";

describe("restrictive listing filter helpers", () => {
  const fullFilters = {
    locations: [{ country: "United States" }],
    experienceLevels: ["Senior"],
    jobCategories: ["Engineering Jobs"],
    salaryFrom: 120_000,
    datePostedWithinDays: 30,
    locationRadiusMiles: 25,
  };

  it("classifies soft vs hard filters", () => {
    expect(hasSoftRestrictiveListingFilters(fullFilters)).toBe(true);
    expect(hasHardRestrictiveListingFilters(fullFilters)).toBe(true);
    expect(hasRestrictiveListingFilters(fullFilters)).toBe(true);
    expect(hasSoftRestrictiveListingFilters({ experienceLevels: ["Senior"] })).toBe(false);
    expect(hasHardRestrictiveListingFilters({ experienceLevels: ["Senior"] })).toBe(true);
  });

  it("relaxSoftListingFilters keeps geography and experience", () => {
    const relaxed = relaxSoftListingFilters(fullFilters);
    expect(relaxed.locations).toEqual(fullFilters.locations);
    expect(relaxed.experienceLevels).toEqual(fullFilters.experienceLevels);
    expect(relaxed.jobCategories).toEqual(fullFilters.jobCategories);
    expect(relaxed.salaryFrom).toBeUndefined();
    expect(relaxed.datePostedWithinDays).toBeUndefined();
    expect(relaxed.locationRadiusMiles).toBeUndefined();
  });

  it("relaxRestrictiveFilters clears hard filters for default feed backfill", () => {
    const relaxed = relaxRestrictiveFilters(fullFilters);
    expect(relaxed.locations).toBeUndefined();
    expect(relaxed.experienceLevels).toBeUndefined();
    expect(relaxed.jobCategories).toBeUndefined();
    expect(relaxed.salaryFrom).toBeUndefined();
  });
});

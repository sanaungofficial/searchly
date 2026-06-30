import { describe, expect, it } from "vitest";
import {
  compactVectorSearchFilters,
  loosenStackedHirebaseFilters,
  sanitizeFiltersForHirebase,
} from "./opportunities-hirebase-filters";

describe("opportunities-hirebase-filters", () => {
  it("taxonomy categories win over custom job functions and titles when set", () => {
    const loosened = loosenStackedHirebaseFilters({
      customJobFunctions: ["Growth Marketing"],
      jobCategories: ["Marketing Jobs"],
      jobTitles: ["PM"],
    });
    expect(loosened.jobCategories).toEqual(["Marketing Jobs"]);
    expect(loosened.customJobFunctions).toBeUndefined();
    expect(loosened.jobTitles).toBeUndefined();
  });

  it("drops taxonomy categories when only custom job functions are set", () => {
    const loosened = loosenStackedHirebaseFilters({
      customJobFunctions: ["Growth Marketing"],
    });
    expect(loosened.jobCategories).toBeUndefined();
    expect(loosened.customJobFunctions).toEqual(["Growth Marketing"]);
  });

  it("keeps location_types for Hirebase payload", () => {
    const sanitized = sanitizeFiltersForHirebase({
      locationTypes: ["Remote"],
      jobTypes: ["Full Time"],
      salaryFrom: 120000,
    });
    expect(sanitized.locationTypes).toEqual(["Remote"]);
    expect(sanitized.jobTypes).toEqual(["Full Time"]);
    expect(sanitized.salaryFrom).toBe(120000);
  });

  it("compactVectorSearchFilters omits empty arrays and false booleans", () => {
    const compact = compactVectorSearchFilters({
      jobTypes: [],
      visaSponsored: false,
      semanticQuery: "  ",
      salaryFrom: 90000,
    });
    expect(compact.jobTypes).toBeUndefined();
    expect(compact.visaSponsored).toBeUndefined();
    expect(compact.semanticQuery).toBeUndefined();
    expect(compact.salaryFrom).toBe(90000);
  });
});

import { describe, expect, it } from "vitest";
import type { CachedJob } from "@/lib/cached-job";
import { jobMatchesListingFilters } from "@/lib/job-listing-filters";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";

function job(overrides: Partial<CachedJob> = {}): CachedJob {
  return {
    title: "Engineer",
    companyName: "Acme",
    location: "Austin, TX, United States",
    url: "https://example.com/job",
    ...overrides,
  } as CachedJob;
}

describe("jobMatchesListingFilters location", () => {
  it("blocks non-US jobs when only United States country filter is set", () => {
    const filters: VectorSearchFilters = {
      locations: [{ country: "United States" }],
    };
    expect(jobMatchesListingFilters(job(), "Acme", filters)).toBe(true);
    expect(
      jobMatchesListingFilters(job({ location: "Kortrijk, West Flanders, Belgium" }), "Acme", filters),
    ).toBe(false);
    expect(jobMatchesListingFilters(job({ location: "Malta" }), "Acme", filters)).toBe(false);
  });
});

describe("jobMatchesListingFilters experience", () => {
  it("matches senior roles when Senior is selected", () => {
    const filters: VectorSearchFilters = { experienceLevels: ["Senior"] };
    expect(
      jobMatchesListingFilters(job({ seniority: "Senior / Lead" }), "Acme", filters),
    ).toBe(true);
    expect(
      jobMatchesListingFilters(job({ seniority: "Junior / Associate" }), "Acme", filters),
    ).toBe(false);
  });
});

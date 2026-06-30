import { describe, expect, it } from "vitest";
import { jobMatchesExclusionPrefs } from "./opportunities-exclusion-filters";
import type { CachedJob } from "./cached-job";

const baseJob: CachedJob = {
  title: "Sales Manager",
  location: "Remote, US",
  department: null,
  url: "https://example.com/job",
  companySummary: null,
  description: "B2B SaaS sales leadership",
  skills: ["Salesforce"],
};

describe("opportunities-exclusion-filters", () => {
  it("drops jobs matching excluded title", () => {
    expect(
      jobMatchesExclusionPrefs(baseJob, "Acme", { excludedJobTitles: ["Sales"] }),
    ).toBe(false);
  });

  it("drops jobs matching excluded company", () => {
    expect(
      jobMatchesExclusionPrefs(baseJob, "Staffing Co", { excludedCompanies: ["Staffing"] }),
    ).toBe(false);
  });

  it("passes when no exclusions", () => {
    expect(jobMatchesExclusionPrefs(baseJob, "Acme", {})).toBe(true);
  });
});

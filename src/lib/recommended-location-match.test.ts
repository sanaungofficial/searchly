import { describe, expect, it } from "vitest";
import { selectDisplayJobs } from "@/lib/job-fit-ranking";
import {
  parseProfileLocationString,
  profileLocationToHirebaseFilters,
  resolveProfileLocation,
} from "@/lib/profile-location";
import { personalNameMatchTokens, parsedResumeToMatchText } from "@/lib/resume-parse";
import { fallbackJobMatch } from "@/lib/resume-match";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

function mockJob(companyName: string, title: string, score: number): VectorMatchedJob {
  return {
    companyName,
    title,
    url: `https://example.com/${companyName}/${title}`,
    matchScore: score,
    matchLabel: "Good",
    matchReasons: [],
    location: "Remote",
    description: "",
    datePosted: "2026-01-01",
  } as VectorMatchedJob;
}

describe("resolveProfileLocation", () => {
  it("prefers targetMarket over parsed resume location", () => {
    expect(
      resolveProfileLocation({
        targetMarket: "Richmond, VA",
        parsedLocation: "Paris, France",
      }),
    ).toBe("Richmond, VA");
  });
});

describe("profileLocationToHirebaseFilters", () => {
  it("returns US country filter for local US profiles", () => {
    const filters = profileLocationToHirebaseFilters({
      profileLocation: "Richmond, VA",
      priorities: [],
    });
    expect(filters).toEqual([{ country: "United States" }]);
  });

  it("returns empty filters when location is unknown", () => {
    expect(profileLocationToHirebaseFilters({ profileLocation: null })).toEqual([]);
  });
});

describe("personal name matching", () => {
  it("excludes first-name tokens from keyword match", () => {
    const resumeText = parsedResumeToMatchText({
      name: "Chanel Talmadge",
      email: null,
      phone: null,
      location: "Richmond, VA",
      linkedinUrl: null,
      website: null,
      summary: "Customer service and communication skills.",
      skills: [],
      tools: [],
      skillGroups: [],
      workExperience: [],
      education: [],
      certifications: [],
    });
    expect(resumeText.toLowerCase()).not.toContain("chanel");
    const result = fallbackJobMatch(
      "CHANEL boutique operations assistant stage in Paris France",
      resumeText,
      { excludeTerms: personalNameMatchTokens({ name: "Chanel Talmadge" } as never) },
    );
    const chanelKeyword = result.keywords.find((k) => k.text === "chanel");
    expect(chanelKeyword?.matched ?? false).toBe(false);
  });
});

describe("selectDisplayJobs employer cap", () => {
  it("limits roles per company", () => {
    const jobs = [
      mockJob("CHANEL", "Role A", 80),
      mockJob("CHANEL", "Role B", 78),
      mockJob("CHANEL", "Role C", 76),
      mockJob("Acme", "Role D", 75),
      mockJob("Beta", "Role E", 74),
    ];
    const selected = selectDisplayJobs(jobs, { displayCount: 5, maxJobsPerCompany: 2 });
    expect(selected.filter((j) => j.companyName === "CHANEL")).toHaveLength(2);
  });
});

describe("parseProfileLocationString", () => {
  it("parses US city and state", () => {
    expect(parseProfileLocationString("Richmond, VA")).toEqual({
      city: "Richmond",
      region: "Virginia",
      country: "United States",
    });
  });
});

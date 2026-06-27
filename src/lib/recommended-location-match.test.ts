import { describe, expect, it } from "vitest";
import { selectDisplayJobs } from "@/lib/job-fit-ranking";
import {
  formatCompactProfileLocation,
  jobMatchesLocationPreference,
  parseProfileLocationString,
  profileLocationToHirebaseFilters,
  relocationScopeFromProfile,
  resolveProfileLocation,
} from "@/lib/profile-location";
import { personalNameMatchTokens, parsedResumeToMatchText } from "@/lib/resume-parse";
import { fallbackJobMatch } from "@/lib/resume-match";
import type { CachedJob } from "@/lib/cached-job";
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
  it("returns US country filter for US profiles", () => {
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

describe("relocationScopeFromProfile", () => {
  it("defaults to domestic when relocation is unspecified", () => {
    expect(relocationScopeFromProfile({ priorities: [] })).toBe("domestic");
  });

  it("uses local scope when user prefers to stay in current area", () => {
    expect(
      relocationScopeFromProfile({
        priorities: ["Prefer to stay in my current area"],
      }),
    ).toBe("local");
  });
});

describe("jobMatchesLocationPreference", () => {
  function cachedJob(location: string, remote?: boolean): CachedJob {
    return {
      title: "Engineer",
      companyName: "Acme",
      location,
      remote,
      url: "https://example.com/job",
    } as CachedJob;
  }

  const vaProfile = { profileLocation: "Fairfax, VA", priorities: [] as string[] };

  it("includes US remote roles for domestic-default profiles", () => {
    expect(jobMatchesLocationPreference(cachedJob("Remote", true), undefined, vaProfile)).toBe(true);
    expect(jobMatchesLocationPreference(cachedJob("Remote, United States", true), undefined, vaProfile)).toBe(
      true,
    );
  });

  it("includes in-person roles in other US states under domestic default", () => {
    expect(jobMatchesLocationPreference(cachedJob("San Francisco, CA"), undefined, vaProfile)).toBe(true);
  });

  it("blocks overseas in-person roles for US profiles", () => {
    expect(jobMatchesLocationPreference(cachedJob("Paris, France"), undefined, vaProfile)).toBe(false);
  });

  it("blocks overseas-tagged remote roles for US profiles", () => {
    expect(jobMatchesLocationPreference(cachedJob("Remote — Zurich, Switzerland", true), undefined, vaProfile)).toBe(
      false,
    );
  });

  it("restricts other US states when user prefers local area", () => {
    expect(
      jobMatchesLocationPreference(cachedJob("San Francisco, CA"), undefined, {
        profileLocation: "Fairfax, VA",
        priorities: ["Prefer to stay in my current area"],
      }),
    ).toBe(false);
    expect(
      jobMatchesLocationPreference(cachedJob("Fairfax, VA"), undefined, {
        profileLocation: "Fairfax, VA",
        priorities: ["Prefer to stay in my current area"],
      }),
    ).toBe(true);
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

describe("formatCompactProfileLocation", () => {
  it("formats US city and state as City, ST", () => {
    expect(
      formatCompactProfileLocation(parseProfileLocationString("Richmond, VA")),
    ).toBe("Richmond, VA");
  });
});

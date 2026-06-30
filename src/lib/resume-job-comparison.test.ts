import { describe, expect, it } from "vitest";
import {
  compareJobTitles,
  computeResumeJobMatch,
  extractJobKeywords,
  extractRequiredYears,
  extractResumeTitle,
} from "./resume-job-comparison";

const SAMPLE_JD = `
Senior Product Manager

Requirements:
- 5+ years of product management experience
- Strong experience with SaaS and B2B platforms
- Proficiency in SQL, analytics, and roadmap planning
- Excellent communication and stakeholder management
- Experience in fintech or payments is a plus
`;

const SAMPLE_RESUME = `
Jane Doe
Senior Product Manager

SUMMARY
Product leader with 7 years building B2B SaaS platforms in fintech.

EXPERIENCE
Senior Product Manager | PayFlow Inc
Jan 2019 – Present
- Led roadmap for payments platform
- SQL, analytics, stakeholder management

Product Manager | TechCo
2016 – 2018
- SaaS platform growth
`;

describe("extractJobKeywords", () => {
  it("pulls terms from requirements bullets", () => {
    const keywords = extractJobKeywords(SAMPLE_JD);
    expect(keywords.some((k) => k.includes("sql") || k === "sql")).toBe(true);
    expect(keywords.some((k) => ["saas", "b2b", "fintech", "platforms"].includes(k))).toBe(true);
  });
});

describe("extractRequiredYears", () => {
  it("finds minimum years from JD", () => {
    expect(extractRequiredYears(SAMPLE_JD)).toBe(5);
  });
});

describe("extractResumeTitle", () => {
  it("finds headline title", () => {
    expect(extractResumeTitle(SAMPLE_RESUME)).toMatch(/product manager/i);
  });
});

describe("compareJobTitles", () => {
  it("matches similar titles", () => {
    expect(compareJobTitles("Senior Product Manager", "Senior Product Manager")).toBe(true);
  });
});

describe("computeResumeJobMatch", () => {
  it("returns structured comparison with keyword matches", () => {
    const result = computeResumeJobMatch({
      jobTitle: "Senior Product Manager",
      company: "Acme",
      description: SAMPLE_JD,
      resumeText: SAMPLE_RESUME,
    });

    expect(result.score).toBeGreaterThan(4);
    expect(result.jobTitleMatch).toBe(true);
    expect(result.yoeMatch).toBe(true);
    expect(result.keywords.length).toBeGreaterThan(0);
    expect(result.keywords.some((k) => k.matched)).toBe(true);
    expect(result.summaryNote.length).toBeGreaterThan(10);
    expect(result.industryTags?.some((t) => t.matched)).toBe(true);
  });
});

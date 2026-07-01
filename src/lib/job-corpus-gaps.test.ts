import { describe, expect, it } from "vitest";
import {
  corpusGapSourceLabel,
  corpusGapsForRole,
  readRoleCorpusGaps,
  writeRoleCorpusGaps,
  type RoleCorpusGapsCache,
} from "./job-corpus-gaps";

describe("roleCorpusGaps cache", () => {
  const sample: RoleCorpusGapsCache = {
    version: 1,
    refreshedAt: "2026-07-01T00:00:00.000Z",
    byRole: {
      "product manager": {
        role: "Product Manager",
        jobCount: 12,
        savedJobCount: 1,
        gaps: [
          {
            skill: "SQL",
            kind: "technology",
            count: 8,
            sources: ["corpus"],
            rankScore: 108,
          },
          {
            skill: "dbt",
            kind: "technology",
            count: 1,
            sources: ["saved_job"],
            rankScore: 1001,
          },
        ],
      },
    },
  };

  it("round-trips through parsedData", () => {
    const parsed = writeRoleCorpusGaps({}, sample);
    expect(readRoleCorpusGaps(parsed)).toEqual(sample);
  });

  it("returns gaps for a role case-insensitively", () => {
    expect(corpusGapsForRole(sample, "product manager")).toHaveLength(2);
    expect(corpusGapsForRole(sample, "Product Manager")[0]?.skill).toBe("SQL");
  });

  it("labels gap sources for UI", () => {
    expect(corpusGapSourceLabel("saved_job")).toBe("Saved job");
    expect(corpusGapSourceLabel("corpus")).toBe("Job postings");
  });
});

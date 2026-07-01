import { describe, expect, it } from "vitest";
import {
  hirebaseCategoryToSumbleJobFunction,
  inferSumbleJobFunctionFromRole,
  inferSumbleJobLevel,
  resolveDiscoveryBenchmark,
  titleTokensForBenchmark,
} from "./benchmark-role";
import { buildDiscoverySearchDebug, buildSumblePeopleQuery, buildSumblePeopleQueryLadder } from "./query-build";
import type { DiscoveryProfileContext } from "./types";

const baseCtx = (overrides: Partial<DiscoveryProfileContext> = {}): DiscoveryProfileContext => ({
  userId: "u1",
  name: "Alex",
  headline: null,
  summary: null,
  targetRoles: [],
  prioritizedRoles: [],
  prioritizedCategories: [],
  benchmarkCategoryOverride: null,
  location: null,
  linkedinUrl: null,
  parsedData: null,
  ...overrides,
});

describe("benchmark-role", () => {
  it("maps Hirebase Arts category to Sumble Arts job function", () => {
    expect(hirebaseCategoryToSumbleJobFunction("Arts Jobs")).toBe("Arts");
  });

  it("infers Education from dance program director when no category", () => {
    const resolution = resolveDiscoveryBenchmark(
      baseCtx({ targetRoles: ["Dance Program Director"] }),
    );
    expect(resolution.sumbleJobFunction).toBe("Arts");
    expect(resolution.sumbleJobLevel).toBe("Director");
    expect(resolution.titleTokens).toContain("Program Director");
    expect(resolution.titleTokens.some((t) => /dance/i.test(t))).toBe(false);
  });

  it("prefers user override category", () => {
    const resolution = resolveDiscoveryBenchmark(
      baseCtx({
        targetRoles: ["Dance Program Director"],
        benchmarkCategoryOverride: "Education Jobs",
      }),
    );
    expect(resolution.source).toBe("override");
    expect(resolution.sumbleJobFunction).toBe("Education");
  });

  it("uses prioritizedCategories before role inference", () => {
    const resolution = resolveDiscoveryBenchmark(
      baseCtx({
        targetRoles: ["Dance Program Director"],
        prioritizedCategories: ["Operations Jobs"],
      }),
    );
    expect(resolution.sumbleJobFunction).toBe("Operations");
    expect(resolution.source).toBe("prioritized_category");
  });

  it("extracts director level and generic title tokens", () => {
    expect(inferSumbleJobLevel("Program Director")).toBe("Director");
    expect(inferSumbleJobFunctionFromRole("Revenue Operations Manager")).toBe("Operations");
    expect(titleTokensForBenchmark("Dance Program Director")).toEqual(
      expect.arrayContaining(["Program Director", "Director"]),
    );
  });
});

describe("buildSumblePeopleQuery", () => {
  it("combines job function, title, and location for PM", () => {
    const ctx = baseCtx({
      targetRoles: ["Product Manager"],
      prioritizedCategories: ["Product Jobs"],
      location: "San Francisco, CA",
      parsedData: { skills: ["Python", "SQL"], tools: ["Figma"] },
    });
    const query = buildSumblePeopleQuery(ctx);
    expect(query).toContain('job_function EQ "Product"');
    expect(query).toContain("Product Manager");
    expect(query).toContain("San Francisco");
    expect(query).not.toContain("technology EQ");
  });

  it("returns null when no filters can be built", () => {
    expect(buildSumblePeopleQuery(baseCtx())).toBeNull();
  });

  it("builds a fallback ladder for niche roles", () => {
    const ctx = baseCtx({ targetRoles: ["Dance Program Director"] });
    const ladder = buildSumblePeopleQueryLadder(ctx);
    expect(ladder.length).toBeGreaterThan(2);
    expect(ladder.some((step) => step.query.includes('job_function EQ "Arts"'))).toBe(true);
    expect(ladder.some((step) => step.query.includes('job_level EQ "Director"'))).toBe(true);
  });

  it("includes search debug metadata", () => {
    const debug = buildDiscoverySearchDebug(baseCtx({ targetRoles: ["Dance Program Director"] }));
    expect(debug.targetRole).toBe("Dance Program Director");
    expect(debug.jobFunction).toBe("Arts");
    expect(debug.queriesTried.length).toBeGreaterThan(0);
  });
});

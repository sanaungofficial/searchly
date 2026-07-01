import { describe, expect, it } from "vitest";
import { buildSumblePeopleQuery } from "./query-build";
import type { DiscoveryProfileContext } from "./types";

describe("buildSumblePeopleQuery", () => {
  it("combines roles, skills, and location", () => {
    const ctx: DiscoveryProfileContext = {
      userId: "u1",
      name: "Alex",
      headline: "PM",
      summary: null,
      targetRoles: ["Product Manager"],
      prioritizedRoles: [],
      prioritizedCategories: [],
      location: "San Francisco, CA",
      linkedinUrl: null,
      parsedData: { skills: ["Python", "SQL"], tools: ["Figma"] },
    };
    const query = buildSumblePeopleQuery(ctx);
    expect(query).toContain("Product Manager");
    expect(query).toContain("Python");
    expect(query).toContain("San Francisco");
  });

  it("returns null when no filters can be built", () => {
    const ctx: DiscoveryProfileContext = {
      userId: "u1",
      name: "Alex",
      headline: null,
      summary: null,
      targetRoles: [],
      prioritizedRoles: [],
      prioritizedCategories: [],
      location: null,
      linkedinUrl: null,
      parsedData: null,
    };
    expect(buildSumblePeopleQuery(ctx)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { UPSKILL_CATALOG, buildUpskillCatalog, kimchiPickEntriesForSkills } from "@/lib/upskill-catalog";
import { findProgramsForSkill, skillMatchesLabel } from "@/lib/upskill-programs";

describe("UPSKILL_CATALOG", () => {
  it("generates approximately 50 systematic entries", () => {
    expect(UPSKILL_CATALOG.length).toBeGreaterThanOrEqual(48);
    expect(UPSKILL_CATALOG.length).toBeLessThanOrEqual(52);
  });

  it("includes seeds from UPSKILL_CATEGORIES plus archetype gaps and tools", () => {
    const ids = new Set(UPSKILL_CATALOG.map((e) => e.id));
    expect(ids.has("0")).toBe(true);
    expect([...ids].some((id) => id.startsWith("gap_"))).toBe(true);
    expect([...ids].some((id) => id.startsWith("tech_"))).toBe(true);
  });

  it("marks catalog entries as kimchi picks", () => {
    expect(UPSKILL_CATALOG.every((e) => e.kimchiPick)).toBe(true);
  });
});

describe("findProgramsForSkill", () => {
  it("matches SQL to Mode Analytics catalog entry", () => {
    const programs = findProgramsForSkill("SQL");
    expect(programs.length).toBeGreaterThan(0);
    expect(programs[0]?.source).toBe("catalog");
    expect(programs[0]?.name).toMatch(/SQL/i);
    expect(programs[0]?.platform).toBe("Mode Analytics");
    expect(programs[0]?.kimchiPick).toBe(true);
  });

  it("matches Product Strategy to Reforge catalog entry", () => {
    const programs = findProgramsForSkill("Product Strategy");
    const catalogHit = programs.find((p) => p.source === "catalog");
    expect(catalogHit?.name).toMatch(/Product Strategy/i);
    expect(catalogHit?.platform).toBe("Reforge");
  });

  it("matches Financial Modeling to Wall Street Prep", () => {
    const programs = findProgramsForSkill("Financial Modeling");
    expect(programs[0]?.platform).toBe("Wall Street Prep");
    expect(programs[0]?.source).toBe("catalog");
  });

  it("falls back to search links for unmatched gaps", () => {
    const programs = findProgramsForSkill("Obscure Niche Competency XYZ123");
    expect(programs.some((p) => p.source === "search")).toBe(true);
    const searchOnly = programs.filter((p) => p.source === "search");
    expect(searchOnly.length).toBeGreaterThan(0);
    expect(searchOnly[0]?.kimchiPick).toBe(false);
  });

  it("respects limit and dedupes catalog matches", () => {
    const programs = findProgramsForSkill("Stakeholder Management", 2);
    expect(programs.length).toBeLessThanOrEqual(2);
    expect(new Set(programs.map((p) => p.id)).size).toBe(programs.length);
  });
});

describe("skillMatchesLabel", () => {
  it("matches token overlap for compound skills", () => {
    expect(skillMatchesLabel("Data Analysis", "Business Analytics")).toBe(true);
    expect(skillMatchesLabel("GTM", "GTM Strategy")).toBe(true);
  });
});

describe("kimchiPickEntriesForSkills", () => {
  it("returns catalog picks overlapping queued skills", () => {
    const picks = kimchiPickEntriesForSkills(["SQL", "Python"]);
    expect(picks.length).toBeGreaterThanOrEqual(2);
    expect(picks.every((p) => p.kimchiPick)).toBe(true);
  });
});

describe("buildUpskillCatalog", () => {
  it("is deterministic for a fixed target size", () => {
    const a = buildUpskillCatalog(50).map((e) => e.id);
    const b = buildUpskillCatalog(50).map((e) => e.id);
    expect(a).toEqual(b);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeParsedResumeData } from "@/lib/resume-parse";
import { searchPreferencesFromParsedData } from "@/lib/search-preferences";

describe("normalizeParsedResumeData extensions", () => {
  it("preserves searchPreferences through normalization", () => {
    const raw = {
      name: "Alex Example",
      skills: ["Product"],
      searchPreferences: {
        experienceLevelLabels: ["Mid Level"],
        opportunitiesPrefConfirmedAt: "2026-06-30T12:00:00.000Z",
      },
    };

    const normalized = normalizeParsedResumeData(raw);
    expect(normalized).not.toBeNull();
    expect(searchPreferencesFromParsedData(normalized).opportunitiesPrefConfirmedAt).toBe(
      "2026-06-30T12:00:00.000Z",
    );
    expect(searchPreferencesFromParsedData(normalized).experienceLevelLabels).toEqual(["Mid Level"]);
  });

  it("returns searchPreferences-only parsedData when resume body is empty", () => {
    const raw = {
      searchPreferences: {
        opportunitiesPrefConfirmedAt: "2026-06-30T12:00:00.000Z",
      },
    };

    const normalized = normalizeParsedResumeData(raw);
    expect(normalized).not.toBeNull();
    expect(searchPreferencesFromParsedData(normalized).opportunitiesPrefConfirmedAt).toBe(
      "2026-06-30T12:00:00.000Z",
    );
  });

  it("preserves experienceLevel for default filter derivation", () => {
    const raw = {
      location: "Austin, TX",
      experienceLevel: "Senior",
    };

    const normalized = normalizeParsedResumeData(raw);
    expect(normalized?.experienceLevel).toBe("Senior");
  });
});

import { describe, expect, it } from "vitest";
import { emptyParsedResumeData } from "@/lib/resume-parse";
import { hasProfileSignals, targetRolesFromReadback } from "@/lib/recommended-jobs-engine";

describe("targetRolesFromReadback", () => {
  it("extracts role strings from readback payloads", () => {
    expect(
      targetRolesFromReadback({
        targetRoles: [{ role: "Director of Strategy", fit: "Strong match" }],
      }),
    ).toEqual(["Director of Strategy"]);
  });
});

describe("hasProfileSignals", () => {
  const empty = {
    targetRoles: [] as string[],
    resumeAssetUrl: null,
    profileResumeUrl: null,
    resumeText: "",
    parsedData: emptyParsedResumeData(),
  };

  it("passes when target roles are set", () => {
    expect(hasProfileSignals({ ...empty, targetRoles: ["Product Manager"] })).toBe(true);
  });

  it("passes when readback suggests roles but profile.targetRoles is empty", () => {
    expect(
      hasProfileSignals({
        ...empty,
        readbackData: { targetRoles: [{ role: "GM", fit: "Good fit" }] },
      }),
    ).toBe(true);
  });

  it("passes when resume is on profile", () => {
    expect(hasProfileSignals({ ...empty, profileResumeUrl: "https://example.com/resume.pdf" })).toBe(true);
  });

  it("passes when parsed skills exist", () => {
    expect(
      hasProfileSignals({
        ...empty,
        parsedData: { ...emptyParsedResumeData(), skills: ["Strategy"] },
      }),
    ).toBe(true);
  });

  it("fails for an empty profile", () => {
    expect(hasProfileSignals(empty)).toBe(false);
  });
});

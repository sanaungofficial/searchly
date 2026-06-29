import { describe, expect, it } from "vitest";
import {
  applyImportMergeSections,
  defaultSelectedImportSections,
  diffImportMergeSections,
} from "@/lib/linkedin-import-merge";
import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";

const baseDraft = (): LinkedInProfileDraft => ({
  headline: "Old headline",
  about: "Old about",
  location: "NYC",
  experience: [{ id: "e1", title: "Engineer", company: "Acme", description: "Did things" }],
  education: [{ id: "ed1", school: "State U", degree: "BS CS" }],
  skills: ["Python"],
  featured: [],
  profilePhotoUrl: "https://example.com/old.jpg",
  coverPhotoUrl: null,
});

describe("diffImportMergeSections", () => {
  it("flags changed sections including photos", () => {
    const proposed: LinkedInProfileDraft = {
      ...baseDraft(),
      headline: "New headline",
      skills: ["Python", "Go"],
      profilePhotoUrl: "https://example.com/new.jpg",
    };
    const diffs = diffImportMergeSections(baseDraft(), proposed);
    expect(diffs.find((d) => d.section === "headline")?.hasChange).toBe(true);
    expect(diffs.find((d) => d.section === "skills")?.hasChange).toBe(true);
    expect(diffs.find((d) => d.section === "profilePhoto")?.hasChange).toBe(true);
    expect(diffs.find((d) => d.section === "about")?.hasChange).toBe(false);
  });
});

describe("applyImportMergeSections", () => {
  it("applies only selected sections", () => {
    const current = baseDraft();
    const proposed: LinkedInProfileDraft = {
      ...current,
      headline: "New headline",
      about: "New about",
      skills: ["Go"],
      profilePhotoUrl: "https://example.com/new.jpg",
    };
    const merged = applyImportMergeSections({
      current,
      proposed,
      sections: ["headline", "profilePhoto"],
    });
    expect(merged.headline).toBe("New headline");
    expect(merged.about).toBe("Old about");
    expect(merged.skills).toEqual(["Python"]);
    expect(merged.profilePhotoUrl).toBe("https://example.com/new.jpg");
  });
});

describe("defaultSelectedImportSections", () => {
  it("prefers changed sections", () => {
    const diffs = diffImportMergeSections(baseDraft(), { ...baseDraft(), headline: "X" });
    expect(defaultSelectedImportSections(diffs)).toEqual(["headline"]);
  });
});

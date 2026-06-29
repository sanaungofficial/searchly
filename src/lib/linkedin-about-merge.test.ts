import { describe, expect, it } from "vitest";
import {
  applyAboutMergeSections,
  defaultSelectedMergeSections,
  diffAboutMergeSections,
} from "@/lib/linkedin-about-merge";
import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";

const baseDraft = (): LinkedInProfileDraft => ({
  headline: "Old headline",
  about: "Old about",
  location: "NYC",
  experience: [{ id: "e1", title: "Engineer", company: "Acme", description: "Did things" }],
  education: [{ id: "ed1", school: "State U", degree: "BS CS" }],
  skills: ["Python"],
  featured: [],
});

describe("diffAboutMergeSections", () => {
  it("flags changed sections", () => {
    const proposed: LinkedInProfileDraft = {
      ...baseDraft(),
      headline: "New headline",
      skills: ["Python", "Go"],
    };
    const diffs = diffAboutMergeSections(baseDraft(), proposed);
    expect(diffs.find((d) => d.section === "headline")?.hasChange).toBe(true);
    expect(diffs.find((d) => d.section === "skills")?.hasChange).toBe(true);
    expect(diffs.find((d) => d.section === "about")?.hasChange).toBe(false);
  });
});

describe("applyAboutMergeSections", () => {
  it("applies only selected sections", () => {
    const current = baseDraft();
    const proposed: LinkedInProfileDraft = {
      ...current,
      headline: "New headline",
      about: "New about",
      skills: ["Go"],
    };
    const merged = applyAboutMergeSections({
      current,
      proposed,
      sections: ["headline"],
    });
    expect(merged.headline).toBe("New headline");
    expect(merged.about).toBe("Old about");
    expect(merged.skills).toEqual(["Python"]);
  });
});

describe("defaultSelectedMergeSections", () => {
  it("prefers changed sections", () => {
    const diffs = diffAboutMergeSections(baseDraft(), { ...baseDraft(), headline: "X" });
    expect(defaultSelectedMergeSections(diffs)).toEqual(["headline"]);
  });
});

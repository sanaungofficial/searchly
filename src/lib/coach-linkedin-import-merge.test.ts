import { describe, expect, it } from "vitest";
import type { CoachProfile } from "@prisma/client";
import type { ApifyLinkedInProfile } from "@/lib/apify-linkedin";
import {
  buildCoachLinkedInImportProposed,
  diffCoachLinkedInImportSections,
  defaultSelectedCoachImportSections,
} from "@/lib/coach-linkedin-import-merge";

const coach = {
  id: "coach_1",
  displayName: "Jane Coach",
  headline: "Old headline",
  bio: "Old bio",
  aboutMe: null,
  currentRole: "Advisor",
  currentCompany: "Kimchi",
  location: "Remote",
  linkedinUrl: "https://www.linkedin.com/in/jane-coach",
  photoUrl: "https://example.com/old.jpg",
  firms: ["McKinsey"],
  schools: [],
  specialties: ["Strategy"],
} as CoachProfile;

const scraped: ApifyLinkedInProfile = {
  firstName: "Jane",
  lastName: "Coach",
  headline: "New LinkedIn headline",
  summary: "New LinkedIn bio",
  locationName: "New York, NY",
  picture: "https://media.linkedin.com/new.jpg",
  positions: [{ companyName: "Google", title: "Director", current: true }],
  educations: [{ schoolName: "Wharton", degreeName: "MBA" }],
  skills: [{ skillName: "Leadership" }],
};

describe("diffCoachLinkedInImportSections", () => {
  it("flags changed coach fields including photo", () => {
    const proposed = buildCoachLinkedInImportProposed({
      scraped,
      linkedinUrl: "https://www.linkedin.com/in/jane-coach",
    });
    const diffs = diffCoachLinkedInImportSections(coach, proposed);

    expect(diffs.find((d) => d.section === "headline")?.hasChange).toBe(true);
    expect(diffs.find((d) => d.section === "bio")?.hasChange).toBe(true);
    expect(diffs.find((d) => d.section === "photoUrl")?.hasChange).toBe(true);
    expect(diffs.find((d) => d.section === "firms")?.hasChange).toBe(true);
    expect(diffs.find((d) => d.section === "displayName")?.hasChange).toBe(false);
  });
});

describe("defaultSelectedCoachImportSections", () => {
  it("prefers changed sections", () => {
    const proposed = buildCoachLinkedInImportProposed({
      scraped,
      linkedinUrl: "https://www.linkedin.com/in/jane-coach",
    });
    const diffs = diffCoachLinkedInImportSections(coach, proposed);
    const selected = defaultSelectedCoachImportSections(diffs);
    expect(selected).toContain("headline");
    expect(selected).not.toContain("displayName");
  });
});

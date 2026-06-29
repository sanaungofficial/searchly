import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CoachProfile } from "@prisma/client";
import type { ApifyLinkedInProfile } from "@/lib/apify-linkedin";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    coachProfile: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/persist-external-image", () => ({
  persistExternalImageToAvatarsBucket: vi.fn(async () => ({ url: "https://example.com/photo.jpg" })),
}));

import { applyLinkedInImportForCoach, buildCoachLinkedInImportPreview } from "@/lib/coach-linkedin-import-apply";
import { prisma } from "@/lib/prisma";

const baseCoach = {
  id: "coach_1",
  displayName: "Existing Name",
  headline: "Existing headline",
  bio: null,
  aboutMe: null,
  currentRole: null,
  currentCompany: null,
  location: null,
  linkedinUrl: null,
  photoUrl: null,
  firms: ["McKinsey"],
  schools: [],
  specialties: [],
} as CoachProfile;

const scraped: ApifyLinkedInProfile = {
  firstName: "Jane",
  lastName: "Doe",
  headline: "New headline from LinkedIn",
  summary: "Coach bio from LinkedIn",
  locationName: "New York, NY",
  picture: "https://media.linkedin.com/photo.jpg",
  positions: [{ companyName: "Google", title: "Director", current: true }],
  educations: [{ schoolName: "Wharton", degreeName: "MBA" }],
  skills: [{ skillName: "Leadership" }, { skillName: "Strategy" }],
};

describe("buildCoachLinkedInImportPreview", () => {
  it("returns diffs for coach vs LinkedIn data", () => {
    const preview = buildCoachLinkedInImportPreview({
      coach: baseCoach,
      linkedinUrl: "https://www.linkedin.com/in/jane-doe",
      scraped,
    });

    expect(preview.diffs.find((d) => d.section === "headline")?.hasChange).toBe(true);
    expect(preview.diffs.find((d) => d.section === "bio")?.hasChange).toBe(true);
    expect(preview.diffs.find((d) => d.section === "firms")?.hasChange).toBe(true);
    expect(preview.proposed.currentRole).toBe("Director");
  });
});

describe("applyLinkedInImportForCoach", () => {
  beforeEach(() => {
    vi.mocked(prisma.coachProfile.update).mockReset();
  });

  it("applies only selected sections", async () => {
    vi.mocked(prisma.coachProfile.update).mockResolvedValue({
      ...baseCoach,
      bio: "Coach bio from LinkedIn",
      location: "New York, NY",
      firms: ["McKinsey", "Google"],
    });

    const result = await applyLinkedInImportForCoach({
      coach: baseCoach,
      linkedinUrl: "https://www.linkedin.com/in/jane-doe",
      scraped,
      sections: ["bio", "location", "firms"],
    });

    expect(prisma.coachProfile.update).toHaveBeenCalledWith({
      where: { id: "coach_1" },
      data: expect.objectContaining({
        bio: "Coach bio from LinkedIn",
        location: "New York, NY",
        firms: ["McKinsey", "Google"],
      }),
    });
    expect(result.appliedFields).toEqual(expect.arrayContaining(["bio", "location", "firms"]));
    expect(result.appliedFields).not.toContain("headline");
    expect(result.appliedFields).not.toContain("displayName");
  });

  it("returns without updating when no sections are selected", async () => {
    const result = await applyLinkedInImportForCoach({
      coach: baseCoach,
      linkedinUrl: "https://www.linkedin.com/in/jane-doe",
      scraped,
      sections: [],
    });

    expect(prisma.coachProfile.update).not.toHaveBeenCalled();
    expect(result.appliedFields).toEqual([]);
    expect(result.coach).toBe(baseCoach);
  });
});

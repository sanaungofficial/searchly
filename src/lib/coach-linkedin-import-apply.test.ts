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

import { applyLinkedInImportForCoach } from "@/lib/coach-linkedin-import-apply";
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

describe("applyLinkedInImportForCoach", () => {
  beforeEach(() => {
    vi.mocked(prisma.coachProfile.update).mockReset();
  });

  it("fills only empty fields and merges list values", async () => {
    vi.mocked(prisma.coachProfile.update).mockResolvedValue({
      ...baseCoach,
      bio: "Coach bio from LinkedIn",
      currentRole: "Director",
      currentCompany: "Google",
      location: "New York, NY",
      linkedinUrl: "https://www.linkedin.com/in/jane-doe",
      photoUrl: "https://example.com/photo.jpg",
      firms: ["McKinsey", "Google"],
      schools: ["Wharton — MBA"],
      specialties: ["Leadership", "Strategy"],
    });

    const result = await applyLinkedInImportForCoach({
      coach: baseCoach,
      linkedinUrl: "https://www.linkedin.com/in/jane-doe",
      scraped,
    });

    expect(prisma.coachProfile.update).toHaveBeenCalledWith({
      where: { id: "coach_1" },
      data: expect.objectContaining({
        bio: "Coach bio from LinkedIn",
        currentRole: "Director",
        currentCompany: "Google",
        location: "New York, NY",
        linkedinUrl: "https://www.linkedin.com/in/jane-doe",
        photoUrl: "https://example.com/photo.jpg",
        firms: ["McKinsey", "Google"],
        schools: ["Wharton — MBA"],
        specialties: ["Leadership", "Strategy"],
      }),
    });
    expect(result.filledFields).toEqual(
      expect.arrayContaining(["bio", "currentRole", "currentCompany", "location", "linkedinUrl", "photoUrl", "firms", "schools", "specialties"]),
    );
    expect(result.filledFields).not.toContain("displayName");
    expect(result.filledFields).not.toContain("headline");
  });

  it("returns without updating when all target fields are already populated", async () => {
    const fullCoach = {
      ...baseCoach,
      bio: "Already set",
      aboutMe: "Already set",
      currentRole: "Coach",
      currentCompany: "Kimchi",
      location: "Remote",
      linkedinUrl: "https://www.linkedin.com/in/existing",
      photoUrl: "https://example.com/existing.jpg",
      firms: ["McKinsey", "Google"],
      schools: ["Wharton — MBA"],
      specialties: ["Leadership", "Strategy"],
    } as CoachProfile;

    const result = await applyLinkedInImportForCoach({
      coach: fullCoach,
      linkedinUrl: "https://www.linkedin.com/in/jane-doe",
      scraped,
    });

    expect(prisma.coachProfile.update).not.toHaveBeenCalled();
    expect(result.filledFields).toEqual([]);
    expect(result.coach).toBe(fullCoach);
  });
});

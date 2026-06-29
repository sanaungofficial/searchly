import { describe, expect, it } from "vitest";
import { mapApifyProfileToLinkedInDraft } from "@/lib/apify-linkedin";
import { isKimchiHostedAvatarUrl } from "@/lib/persist-external-image";

describe("mapApifyProfileToLinkedInDraft photos", () => {
  it("maps profile and cover photo URLs from anchor actor fields", () => {
    const draft = mapApifyProfileToLinkedInDraft({
      firstName: "Jane",
      lastName: "Doe",
      picture: "https://cdn.example.com/profile.jpg",
      backgroundCoverImageUrl: "https://cdn.example.com/cover.jpg",
    });

    expect(draft.profilePhotoUrl).toBe("https://cdn.example.com/profile.jpg");
    expect(draft.coverPhotoUrl).toBe("https://cdn.example.com/cover.jpg");
  });
});

describe("isKimchiHostedAvatarUrl", () => {
  it("detects Supabase avatars bucket URLs", () => {
    expect(
      isKimchiHostedAvatarUrl(
        "https://xyz.supabase.co/storage/v1/object/public/avatars/user/linkedin-profile.jpg",
      ),
    ).toBe(true);
    expect(isKimchiHostedAvatarUrl("https://media.licdn.com/dms/image/photo.jpg")).toBe(false);
  });
});

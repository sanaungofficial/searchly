import { describe, expect, it, vi, beforeEach } from "vitest";
import { mapApifyProfileToLinkedInDraft } from "@/lib/apify-linkedin";
import { isKimchiHostedAvatarUrl } from "@/lib/persist-external-image";

vi.mock("@/lib/persist-external-image", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/persist-external-image")>();
  return {
    ...actual,
    persistExternalImageToAvatarsBucket: vi.fn(async ({ sourceUrl }: { sourceUrl: string }) => ({
      url: `https://storage.example/avatars/${encodeURIComponent(sourceUrl)}`,
    })),
  };
});

import {
  hasStoredPhotoUrl,
  resolveLinkedInCoverPhotoImport,
  resolveLinkedInProfilePhotoImport,
} from "@/lib/linkedin-import-photos";
import { persistExternalImageToAvatarsBucket } from "@/lib/persist-external-image";

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

describe("hasStoredPhotoUrl", () => {
  it("treats blank values as empty", () => {
    expect(hasStoredPhotoUrl(null)).toBe(false);
    expect(hasStoredPhotoUrl("")).toBe(false);
    expect(hasStoredPhotoUrl("  ")).toBe(false);
    expect(hasStoredPhotoUrl("https://example.com/a.jpg")).toBe(true);
  });
});

describe("resolveLinkedInProfilePhotoImport", () => {
  beforeEach(() => {
    vi.mocked(persistExternalImageToAvatarsBucket).mockClear();
  });

  it("persists once and fills both fields when draft and avatar are empty", async () => {
    const result = await resolveLinkedInProfilePhotoImport({
      sourceUrl: "https://media.linkedin.com/photo.jpg",
      storagePath: "user_1/linkedin-profile.jpg",
      existingDraftPhotoUrl: null,
      existingUserAvatarUrl: null,
    });

    expect(persistExternalImageToAvatarsBucket).toHaveBeenCalledTimes(1);
    expect(result.profilePhotoUrl).toContain("media.linkedin.com");
    expect(result.avatarUrl).toBe(result.profilePhotoUrl);
    expect(result.avatarUrlToPersist).toBe(result.profilePhotoUrl);
  });

  it("backfills user avatar from existing draft photo without re-uploading", async () => {
    const existing = "https://storage.example/avatars/existing.jpg";
    const result = await resolveLinkedInProfilePhotoImport({
      sourceUrl: "https://media.linkedin.com/new.jpg",
      storagePath: "user_1/linkedin-profile.jpg",
      existingDraftPhotoUrl: existing,
      existingUserAvatarUrl: null,
    });

    expect(persistExternalImageToAvatarsBucket).not.toHaveBeenCalled();
    expect(result.profilePhotoUrl).toBe(existing);
    expect(result.avatarUrl).toBe(existing);
    expect(result.avatarUrlToPersist).toBe(existing);
  });

  it("copies existing avatar into draft when draft photo is empty", async () => {
    const existing = "https://storage.example/avatars/user.jpg";
    const result = await resolveLinkedInProfilePhotoImport({
      sourceUrl: "https://media.linkedin.com/new.jpg",
      storagePath: "user_1/linkedin-profile.jpg",
      existingDraftPhotoUrl: null,
      existingUserAvatarUrl: existing,
    });

    expect(persistExternalImageToAvatarsBucket).not.toHaveBeenCalled();
    expect(result.profilePhotoUrl).toBe(existing);
    expect(result.avatarUrl).toBe(existing);
    expect(result.avatarUrlToPersist).toBeNull();
  });

  it("never overwrites existing draft or avatar photos", async () => {
    const draft = "https://storage.example/draft.jpg";
    const avatar = "https://storage.example/avatar.jpg";
    const result = await resolveLinkedInProfilePhotoImport({
      sourceUrl: "https://media.linkedin.com/new.jpg",
      storagePath: "user_1/linkedin-profile.jpg",
      existingDraftPhotoUrl: draft,
      existingUserAvatarUrl: avatar,
    });

    expect(persistExternalImageToAvatarsBucket).not.toHaveBeenCalled();
    expect(result.profilePhotoUrl).toBe(draft);
    expect(result.avatarUrl).toBe(avatar);
    expect(result.avatarUrlToPersist).toBeNull();
  });
});

describe("resolveLinkedInCoverPhotoImport", () => {
  beforeEach(() => {
    vi.mocked(persistExternalImageToAvatarsBucket).mockClear();
  });

  it("fills empty cover when section is selected", async () => {
    const result = await resolveLinkedInCoverPhotoImport({
      sourceUrl: "https://media.linkedin.com/cover.jpg",
      storagePath: "user_1/linkedin-cover.jpg",
      existingCoverPhotoUrl: null,
      sectionSelected: true,
    });

    expect(persistExternalImageToAvatarsBucket).toHaveBeenCalledTimes(1);
    expect(result.coverPhotoUrl).toContain("media.linkedin.com");
  });

  it("skips cover import when section is not selected", async () => {
    const result = await resolveLinkedInCoverPhotoImport({
      sourceUrl: "https://media.linkedin.com/cover.jpg",
      storagePath: "user_1/linkedin-cover.jpg",
      existingCoverPhotoUrl: null,
      sectionSelected: false,
    });

    expect(persistExternalImageToAvatarsBucket).not.toHaveBeenCalled();
    expect(result.coverPhotoUrl).toBeNull();
  });

  it("never replaces an existing cover photo", async () => {
    const existing = "https://storage.example/cover.jpg";
    const result = await resolveLinkedInCoverPhotoImport({
      sourceUrl: "https://media.linkedin.com/cover.jpg",
      storagePath: "user_1/linkedin-cover.jpg",
      existingCoverPhotoUrl: existing,
      sectionSelected: true,
    });

    expect(persistExternalImageToAvatarsBucket).not.toHaveBeenCalled();
    expect(result.coverPhotoUrl).toBe(existing);
  });
});

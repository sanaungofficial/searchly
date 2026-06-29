import { persistExternalImageToAvatarsBucket } from "@/lib/persist-external-image";

export function hasStoredPhotoUrl(url: string | null | undefined): boolean {
  return Boolean(url?.trim());
}

export type LinkedInProfilePhotoImportResult = {
  profilePhotoUrl: string | null;
  avatarUrl: string | null;
  /** Set when User.avatarUrl should be updated (field was empty). */
  avatarUrlToPersist: string | null;
};

/**
 * Fill empty profile draft photo and user avatar from a LinkedIn image URL.
 * Never overwrites existing photos in either field.
 */
export async function resolveLinkedInProfilePhotoImport(input: {
  sourceUrl: string | null | undefined;
  storagePath: string;
  existingDraftPhotoUrl?: string | null;
  existingUserAvatarUrl?: string | null;
}): Promise<LinkedInProfilePhotoImportResult> {
  const source = input.sourceUrl?.trim() || null;
  const existingDraft = input.existingDraftPhotoUrl?.trim() || null;
  const existingAvatar = input.existingUserAvatarUrl?.trim() || null;

  let profilePhotoUrl = existingDraft;
  let avatarUrl = existingAvatar;

  const needsDraftPhoto = !hasStoredPhotoUrl(existingDraft);
  const needsAvatar = !hasStoredPhotoUrl(existingAvatar);

  if (!source || (!needsDraftPhoto && !needsAvatar)) {
    return {
      profilePhotoUrl: existingDraft,
      avatarUrl: existingAvatar ?? existingDraft,
      avatarUrlToPersist: null,
    };
  }

  if (needsDraftPhoto && needsAvatar) {
    const persisted = await persistExternalImageToAvatarsBucket({
      sourceUrl: source,
      storagePath: input.storagePath,
      existingUrl: null,
    });
    const url = persisted.url ?? source;
    profilePhotoUrl = url;
    avatarUrl = url;
    return { profilePhotoUrl, avatarUrl, avatarUrlToPersist: url };
  }

  if (needsDraftPhoto && hasStoredPhotoUrl(existingAvatar)) {
    profilePhotoUrl = existingAvatar;
    return {
      profilePhotoUrl: existingAvatar,
      avatarUrl: existingAvatar,
      avatarUrlToPersist: null,
    };
  }

  if (needsAvatar && hasStoredPhotoUrl(existingDraft)) {
    avatarUrl = existingDraft;
    return {
      profilePhotoUrl: existingDraft,
      avatarUrl: existingDraft,
      avatarUrlToPersist: existingDraft,
    };
  }

  if (needsDraftPhoto) {
    const persisted = await persistExternalImageToAvatarsBucket({
      sourceUrl: source,
      storagePath: input.storagePath,
      existingUrl: null,
    });
    profilePhotoUrl = persisted.url ?? source;
  }

  if (needsAvatar) {
    const fillFrom = profilePhotoUrl ?? existingDraft;
    if (fillFrom) {
      avatarUrl = fillFrom;
    } else {
      const persisted = await persistExternalImageToAvatarsBucket({
        sourceUrl: source,
        storagePath: input.storagePath,
        existingUrl: null,
      });
      avatarUrl = persisted.url ?? source;
      if (!profilePhotoUrl) profilePhotoUrl = avatarUrl;
    }
  }

  return {
    profilePhotoUrl,
    avatarUrl: avatarUrl ?? existingAvatar,
    avatarUrlToPersist: needsAvatar ? avatarUrl : null,
  };
}

export type LinkedInCoverPhotoImportResult = {
  coverPhotoUrl: string | null;
};

/** Fill empty LinkedIn draft cover photo only — never overwrite an existing cover. */
export async function resolveLinkedInCoverPhotoImport(input: {
  sourceUrl: string | null | undefined;
  storagePath: string;
  existingCoverPhotoUrl?: string | null;
  sectionSelected: boolean;
}): Promise<LinkedInCoverPhotoImportResult> {
  const existing = input.existingCoverPhotoUrl?.trim() || null;
  if (hasStoredPhotoUrl(existing)) {
    return { coverPhotoUrl: existing };
  }

  const source = input.sourceUrl?.trim() || null;
  if (!source || !input.sectionSelected) {
    return { coverPhotoUrl: null };
  }

  const persisted = await persistExternalImageToAvatarsBucket({
    sourceUrl: source,
    storagePath: input.storagePath,
    existingUrl: null,
  });

  return { coverPhotoUrl: persisted.url ?? source };
}

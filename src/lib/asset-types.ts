export type UserAssetType = "RESUME" | "COVER_LETTER" | "JOB_SEARCH_STRATEGY" | "OTHER";

export const ASSET_TYPE_LABELS: Record<UserAssetType, string> = {
  RESUME: "Resume",
  COVER_LETTER: "Cover letter",
  JOB_SEARCH_STRATEGY: "Career strategy",
  OTHER: "Other",
};

export const ASSET_TYPE_ACCEPT: Partial<Record<UserAssetType, string>> = {
  RESUME: ".pdf,.doc,.docx,.txt",
  COVER_LETTER: ".pdf,.doc,.docx,.txt",
  JOB_SEARCH_STRATEGY: ".pdf,.doc,.docx",
  OTHER: ".pdf,.doc,.docx,.txt",
};

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type as UserAssetType] ?? type;
}

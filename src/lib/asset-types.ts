export type UserAssetType =
  | "RESUME"
  | "COVER_LETTER"
  | "JOB_SEARCH_STRATEGY"
  | "PORTFOLIO"
  | "WRITING_SAMPLE"
  | "REFERENCE"
  | "CERTIFICATION"
  | "TRANSCRIPT"
  | "OTHER";

export const ASSET_TYPE_LABELS: Record<UserAssetType, string> = {
  RESUME: "Resume",
  COVER_LETTER: "Cover letter",
  JOB_SEARCH_STRATEGY: "Career strategy",
  PORTFOLIO: "Portfolio",
  WRITING_SAMPLE: "Writing sample",
  REFERENCE: "Reference",
  CERTIFICATION: "Certification",
  TRANSCRIPT: "Transcript",
  OTHER: "Other",
};

export const ASSET_TYPE_ACCEPT: Partial<Record<UserAssetType, string>> = {
  RESUME: ".pdf,.doc,.docx,.txt",
  COVER_LETTER: ".pdf,.doc,.docx,.txt",
  JOB_SEARCH_STRATEGY: ".pdf,.doc,.docx,.txt",
  PORTFOLIO: ".pdf,.doc,.docx,.txt",
  WRITING_SAMPLE: ".pdf,.doc,.docx,.txt",
  REFERENCE: ".pdf,.doc,.docx,.txt",
  CERTIFICATION: ".pdf,.doc,.docx,.txt",
  TRANSCRIPT: ".pdf,.doc,.docx,.txt",
  OTHER: ".pdf,.doc,.docx,.txt",
};

/** Non-resume types users pick when uploading to the file library. */
export type LibraryDocumentType = Exclude<UserAssetType, "RESUME">;

export const LIBRARY_DOCUMENT_UPLOAD_OPTIONS: {
  value: LibraryDocumentType;
  label: string;
  hint: string;
}[] = [
  { value: "JOB_SEARCH_STRATEGY", label: "Career strategy", hint: "Search plan, positioning, target companies" },
  { value: "COVER_LETTER", label: "Cover letter", hint: "Role-specific or template letters" },
  { value: "PORTFOLIO", label: "Portfolio / work samples", hint: "Case studies, decks, project write-ups" },
  { value: "WRITING_SAMPLE", label: "Writing sample", hint: "Articles, memos, published work" },
  { value: "REFERENCE", label: "Reference list", hint: "References or recommendation letters" },
  { value: "CERTIFICATION", label: "Certification", hint: "Licenses, certificates, credentials" },
  { value: "TRANSCRIPT", label: "Transcript", hint: "Education or training transcripts" },
  { value: "OTHER", label: "Other document", hint: "Anything else for your job search" },
];

export const LIBRARY_DOCUMENT_FILTER_TYPES: Array<"all" | LibraryDocumentType> = [
  "all",
  ...LIBRARY_DOCUMENT_UPLOAD_OPTIONS.map((o) => o.value),
];

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABELS[type as UserAssetType] ?? type.replace(/_/g, " ").toLowerCase();
}

export function isLibraryDocumentType(type: string): type is LibraryDocumentType {
  return type !== "RESUME" && type in ASSET_TYPE_LABELS;
}

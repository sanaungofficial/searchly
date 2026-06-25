export type AirtableAttachment = {
  id: string;
  url: string;
  filename?: string;
  size?: number;
  type?: string;
};

export type AirtableRecord = {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
};

export type AirtableListResponse = {
  records: AirtableRecord[];
  offset?: string;
};

export type AirtableSyncSummary = {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  photoUploaded: number;
  photoErrors: number;
  pushed: number;
  errors: string[];
  durationMs: number;
};

export type AirtableSyncMeta = {
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSummary: Partial<AirtableSyncSummary> | null;
};

export type MappedCoachFromAirtable = {
  airtableId: string;
  displayName: string;
  email: string | null;
  headline: string | null;
  bio: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  linkedinUrl: string | null;
  lelandUrl: string | null;
  calLink: string | null;
  firms: string[];
  schools: string[];
  specialties: string[];
  industries: string[];
  hourlyRate: number | null;
  category: string | null;
  featured: boolean;
  status: "ACTIVE" | "PENDING" | "INACTIVE";
  isProfessionalCoach: boolean;
  whyCoach: string | null;
  aboutMe: string | null;
  experienceLevel: string | null;
  clientTier: string | null;
  industryYears: number | null;
  clientSpecializations: string[];
  photoAttachment: AirtableAttachment | null;
};

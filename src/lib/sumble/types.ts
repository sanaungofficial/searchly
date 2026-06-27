export type SumblePersonPreview = {
  personId: number | null;
  name: string;
  title: string | null;
  linkedinUrl: string | null;
  email: string | null;
  contextLabel: string | null;
  confidence: number | null;
};

export type InsiderConnectionBucketId =
  | "decision_makers"
  | "team"
  | "past_companies"
  | "school";

export type InsiderConnectionBucket = {
  id: InsiderConnectionBucketId;
  title: string;
  subtitle: string;
  theme: "green" | "blue" | "purple" | "teal";
  people: SumblePersonPreview[];
  linkedinSearchUrl: string;
  totalCount: number;
};

export type InsiderConnectionsResult = {
  configured: boolean;
  companyName: string;
  sumbleOrganizationId: number | null;
  buckets: InsiderConnectionBucket[];
  error?: string | null;
};

export type InsiderConnectionsJobContext = {
  companyName: string;
  companyWebsite?: string | null;
  linkedinUrl?: string | null;
  jobTitle: string;
  jobTeam?: string | null;
};

export type UserConnectionProfile = {
  pastCompanies: string[];
  pastCompanyLabels: string[];
  schools: string[];
  schoolLabels: string[];
};

export const DISCOVERY_BLOCKERS = [
  "Positioning — my story isn't landing",
  "Not getting interviews",
  "Stuck in the interview loop",
  "Offer / negotiation help",
  "Don't know where to focus",
  "Other",
] as const;

export type DiscoveryBlocker = (typeof DISCOVERY_BLOCKERS)[number];

export type DiscoveryLeadPayload = {
  blocker: DiscoveryBlocker;
  targetCompanies?: string;
  phone?: string;
  preferredContactTime?: string;
  notes?: string;
  trigger?: string;
};

export type DiscoveryLeadContext = {
  userId: string;
  name: string | null;
  email: string;
  targetRoles: string[];
  jobTimeline: string | null;
  targetSalary: string | null;
  linkedinUrl: string | null;
  pipelineSummary: string;
};

export function discoveryLeadInbox(): string {
  return process.env.DISCOVERY_LEAD_EMAIL ?? "sanhaung1@gmail.com";
}

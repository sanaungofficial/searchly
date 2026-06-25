export type EventInterestPayload = {
  topics: string;
  notes?: string;
};

export type EventInterestContext = {
  userId: string;
  name: string | null;
  email: string;
  targetRoles: string[];
  dashboardGoals: string[];
};

export function eventInterestInbox(): string {
  return process.env.EVENT_INTEREST_EMAIL ?? process.env.DISCOVERY_LEAD_EMAIL ?? "sanhaung1@gmail.com";
}

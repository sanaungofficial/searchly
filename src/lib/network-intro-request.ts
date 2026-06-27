export type NetworkIntroRequestContext = {
  userId: string;
  name: string | null;
  email: string;
  targetRoles: string[];
};

export type NetworkIntroRequestPayload = {
  jobId: string;
  jobTitle: string;
  company: string;
  channel: string;
  recruiterName: string | null;
  notes?: string;
};

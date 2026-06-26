export type ExecThreadCookie = {
  name: string;
  value: string;
};

export type ExecThreadSessionData = {
  cookies: ExecThreadCookie[];
};

export type ExecThreadLoginOptions = {
  email: string;
  password: string;
};

export type ExecThreadListingRaw = {
  _id: string;
  slug?: string;
  title?: string;
  company?: { industry?: string; type?: string; name?: string };
  companyDescription?: string;
  jobDescription?: string;
  compensation?: boolean | { min?: number; max?: number; currency?: string } | null;
  level?: string;
  jobType?: string;
  type?: string;
  funcs?: Array<{ name?: string }>;
  locationInfo?: Array<{
    country?: string;
    city?: string;
    state?: string;
    areaDisplayName?: string;
    isRemote?: boolean;
    isHybrid?: boolean;
  }>;
  isRemote?: boolean;
  isHybrid?: boolean;
  isOnsite?: boolean;
  received_date?: string;
  mostRecentlySubmittedDate?: string;
  hasHiringManagers?: boolean;
  confidential?: boolean;
  [key: string]: unknown;
};

export type ExecThreadSearchResponse = {
  metadata?: { totalHits?: number | { value?: number } };
  results?: ExecThreadListingRaw[];
};

export type ExecThreadSyncSummary = {
  fetched: number;
  upserted: number;
  totalHits: number | null;
  durationMs: number;
  authenticated: boolean;
};

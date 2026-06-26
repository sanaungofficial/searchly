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

export type ExecThreadListingLinkUrl = {
  type?: string;
  url?: string | null;
  hasApply?: boolean;
};

export type ExecThreadContactRaw = {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  linkedinUrl?: string;
  agencyName?: string;
  firmName?: string;
  companyName?: string;
  [key: string]: unknown;
};

export type ExecThreadListingRaw = {
  _id: string;
  slug?: string;
  title?: string;
  company?: {
    industry?: string;
    type?: string;
    name?: string;
    employeeCountRange?: string;
    logoUrl?: string;
    url?: string;
    linkedInId?: string;
    linkedInUrl?: string;
    description?: string;
    founded?: string | number;
    stockExchange?: string;
    age?: string;
  };
  companyDescription?: string;
  companyDescriptionSafeHTML?: string;
  longCompanyDescription?: string | null;
  alternateDescription?: string | null;
  companyStockExchange?: string | null;
  jobDescription?: string;
  jobDescriptionSafeHTML?: string;
  summary?: string;
  compensation?: boolean | string | { min?: number; max?: number; currency?: string; total?: { rangeLow?: number; rangeHigh?: number } } | null;
  compensationParts?: unknown;
  level?: string;
  jobType?: string;
  type?: string;
  /** Search API: array of { name }. Preview API: comma-separated string. */
  funcs?: Array<{ name?: string }> | string;
  functions?: Array<{ name?: string; value?: string; label?: string } | string>;
  locationInfo?: Array<{
    country?: string;
    city?: string;
    state?: string;
    areaDisplayName?: string;
    isRemote?: boolean;
    isHybrid?: boolean;
    isHQ?: boolean;
  }>;
  isRemote?: boolean;
  isHybrid?: boolean;
  isOnsite?: boolean;
  received_date?: string;
  mostRecentlySubmittedDate?: string;
  mostRecentlySubmitted?: string;
  hasHiringManagers?: boolean;
  hasRecruiters?: boolean;
  recruiterCount?: number;
  hasRecruiterContactInfo?: boolean;
  confidential?: boolean;
  industry?: string;
  compType?: string;
  travelPercent?: number | null;
  recruitingFirm?: { id?: string; name?: string; _id?: string } | null;
  listingLinkUrl?: ExecThreadListingLinkUrl | null;
  redirectUrl?: string | null;
  isRedirectListing?: boolean;
  hasPrivateListingUrl?: boolean;
  companyContact?: ExecThreadContactRaw | null;
  recruiters?: ExecThreadContactRaw[];
  contacts?: ExecThreadContactRaw[];
  notificationRecipients?: ExecThreadContactRaw[];
  hiringManagers?: ExecThreadContactRaw[];
  hiringManager?: ExecThreadContactRaw;
  unAuthorized?: boolean;
  listingPreview?: ExecThreadListingRaw;
  [key: string]: unknown;
};

export type ExecThreadMemberJobResponse = {
  title?: string;
  unAuthorized?: boolean;
  listingPreview?: ExecThreadListingRaw;
  listing?: ExecThreadListingRaw;
  [key: string]: unknown;
};

export type ExecThreadRedeemOptions = {
  recruitersOrHiringManager?: boolean;
  expressedInterest?: boolean;
  companyContact?: boolean;
};

export type ExecThreadRedeemResponse = {
  error?: string;
  listing?: ExecThreadListingRaw;
  listingPreview?: ExecThreadListingRaw;
  [key: string]: unknown;
};

export type ExecThreadSearchResponse = {
  metadata?: { totalHits?: number | { value?: number } };
  results?: ExecThreadListingRaw[];
};

export type ExecThreadJobExportBundle = {
  searchRow: ExecThreadListingRaw;
  publicPreview: ExecThreadListingRaw | null;
  listingDetail: ExecThreadListingRaw | null;
  memberJob: ExecThreadMemberJobResponse | null;
  redeem: ExecThreadRedeemResponse | null;
};

export type ExecThreadSyncSummary = {
  fetched: number;
  upserted: number;
  totalHits: number | null;
  durationMs: number;
  authenticated: boolean;
  previewHits?: number;
  redeemHits?: number;
  detailSparseSkips?: number;
  mode?: "import" | "refresh";
  failed?: number;
};

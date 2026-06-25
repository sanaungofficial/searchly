export type TopEchelonCookie = {
  name: string;
  value: string;
};

export type TopEchelonTokenPayload = {
  userId?: string;
  user_id?: string;
  session_id?: string;
  session?: string;
  exp?: number;
  iat?: number;
  accessToken?: string;
  access_token?: string;
  refreshToken?: string;
  refresh_token?: string;
  expiresIn?: number;
  expires_in?: number;
  [key: string]: unknown;
};

export type TopEchelonSessionData = {
  cookies: TopEchelonCookie[];
  tokenPayload: TopEchelonTokenPayload | null;
};

export type TopEchelonLoginOptions = {
  email: string;
  password: string;
  rememberMe?: boolean;
  mfaCode?: string;
  newDeviceMfaCode?: string;
};

export type TopEchelonNetworkJobRaw = {
  id: number | string;
  network_id?: string;
  networkId?: string;
  position_title?: string;
  positionTitle?: string;
  city?: string;
  state?: string | { abbreviation?: string; name?: string };
  minimum_compensation?: number | null;
  minimumCompensation?: number | null;
  maximum_compensation?: number | null;
  maximumCompensation?: number | null;
  fee?: string | number | null;
  fee_type?: string | null;
  feeType?: string | null;
  job_type?: string | null;
  jobType?: string | null;
  remote_option?: string | null;
  remoteOption?: string | null;
  description?: string | null;
  uuid?: string;
  job_uuid?: string;
  jobUuid?: string;
  network_job_uuid?: string;
  networkJobUuid?: string;
  comments?: string | null;
  network_status?: string | null;
  networkStatus?: string | null;
  most_recently_shared_at?: string | null;
  mostRecentlySharedAt?: string | null;
  recruiter?: {
    id?: number | string;
    first_name?: string;
    last_name?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  } | null;
  agency_detail?: {
    name?: string;
    company_name?: string;
    companyName?: string;
  } | null;
  agencyDetail?: {
    name?: string;
    companyName?: string;
  } | null;
  /** Full TE export envelope stored on synced rows (list + detail + sub-resources). */
  _kimchiExport?: {
    fetchedAt: string;
    listSummary: TopEchelonNetworkJobRaw;
    agencyDetails: unknown | null;
    submissionSummary: unknown | null;
    shares: unknown | null;
    recruiterDetails: unknown | null;
  };
  [key: string]: unknown;
};

export type TopEchelonPaginatedJobs = {
  entries?: TopEchelonNetworkJobRaw[];
  results?: TopEchelonNetworkJobRaw[];
  pagination?: {
    total_pages?: number;
    total_count?: number;
    current_page?: number;
  };
};

export type TopEchelonSyncSummary = {
  fetched: number;
  upserted: number;
  pages: number;
  totalCount?: number | null;
  detailErrors: number;
  subresourceHits: number;
  fullCatalog?: boolean;
  searchId?: number | string | null;
  durationMs: number;
};

/** Complete API export for one network job (list row + detail + sub-resources). */
export type TopEchelonJobFullExport = {
  listSummary: TopEchelonNetworkJobRaw;
  detail: TopEchelonNetworkJobRaw;
  agencyDetails: unknown | null;
  submissionSummary: unknown | null;
  shares: unknown | null;
  recruiterDetails: unknown | null;
  fieldKeys: {
    listSummary: string[];
    detail: string[];
    agencyDetails: string[] | null;
    submissionSummary: string[] | null;
    shares: string[] | null;
    recruiterDetails: string[] | null;
  };
};

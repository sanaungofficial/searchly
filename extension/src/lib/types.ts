export type JobStage =
  | "SAVED"
  | "APPLYING"
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEWING"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

export type KimchiEnv = "dev" | "prod";

export type ParserId =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "linkedin-jobs"
  | "generic";

export interface ParsedJob {
  company: string;
  role: string;
  url: string;
  stage: JobStage;
  parser: ParserId;
  notes: string;
}

export interface ExtensionSettings {
  env: KimchiEnv;
}

export interface SaveJobResult {
  ok: boolean;
  jobId?: string;
  error?: string;
}

export interface AuthState {
  authenticated: boolean;
  email?: string;
  checkedAt: string;
  error?: string;
}

export type BackgroundMessage =
  | { type: "GET_AUTH"; force?: boolean }
  | { type: "OPEN_LOGIN" }
  | { type: "LOGOUT" }
  | { type: "SAVE_JOB"; payload?: { tabId?: number } }
  | { type: "SAVE_PARSED_JOB"; payload: ParsedJob }
  | { type: "PARSE_PAGE"; payload: { tabId: number } };

export type BackgroundResponse =
  | { type: "AUTH_STATE"; payload: AuthState }
  | { type: "SAVE_RESULT"; payload: SaveJobResult }
  | { type: "PARSED_JOB"; payload: ParsedJob | null };

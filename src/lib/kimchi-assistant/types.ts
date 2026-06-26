export type AssistantPageHint = {
  pathname?: string;
  jobDbId?: string;
  jobRole?: string;
  jobCompany?: string;
  chatView?: string;
};

export type AssistantSuggestionKind =
  | "inbox_email"
  | "follow_up"
  | "profile"
  | "job"
  | "general";

export type AssistantSuggestion = {
  id: string;
  title: string;
  detail: string;
  route?: string;
  priority: number;
  kind?: AssistantSuggestionKind;
  meta?: Record<string, string>;
};

export type AssistantInboxSnapshot = {
  pendingCount: number;
  emailConnected: boolean;
  activities: Array<{
    id: string;
    title: string | null;
    snippet: string | null;
    signal: string;
    companyGuess: string | null;
    roleGuess: string | null;
    nylasMessageId: string | null;
    job: { id: string; company: string; role: string; stage: string } | null;
  }>;
  followUps: Array<{
    jobId: string;
    company: string;
    role: string;
    daysQuiet: number;
    suggestion: string;
    lastMessageId: string | null;
  }>;
};

export type AssistantRoleMode = "seeker" | "coach" | "admin";

export type AssistantContextPayload = {
  roleMode: AssistantRoleMode;
  summary: string;
  strategySnippet: string;
  pipelineSnippet: string;
  pageHint: string;
  creditsHint: string;
  suggestions: AssistantSuggestion[];
  inbox: AssistantInboxSnapshot;
  generatedAt: string;
};

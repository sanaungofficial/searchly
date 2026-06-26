export type AssistantPageHint = {
  pathname?: string;
  jobDbId?: string;
  jobRole?: string;
  jobCompany?: string;
  chatView?: string;
};

export type AssistantSuggestion = {
  id: string;
  title: string;
  detail: string;
  route?: string;
  priority: number;
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
  generatedAt: string;
};

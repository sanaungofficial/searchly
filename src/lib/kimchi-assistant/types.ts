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
    status: string;
    suggestedStage: string | null;
    confidence: number | null;
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

export type AssistantProfileGaps = {
  hasStrategyDoc: boolean;
  hasResume: boolean;
  hasPipelineJobs: boolean;
  emailConnected: boolean;
};

import type { ContextSourceRef } from "@/lib/kimchi-assistant/context-sources";

export type AssistantContextPayload = {
  roleMode: AssistantRoleMode;
  summary: string;
  strategySnippet: string;
  /** Target companies watchlist (TrackedCompany) */
  targetCompaniesSnippet: string;
  /** Excerpt from generated career strategy doc when present */
  strategyDocSnippet: string | null;
  /** Applied + in-process roles with fit rationale */
  activeApplicationsSnippet: string;
  pipelineSnippet: string;
  /** Profile, master resume, coaches, fit highlights — for prompt citation */
  knowsYouSnippet: string;
  pageHint: string;
  creditsHint: string;
  profileGaps: AssistantProfileGaps;
  suggestions: AssistantSuggestion[];
  inbox: AssistantInboxSnapshot;
  generatedAt: string;
  /** Labeled sources for citation + debrief links */
  contextSources: ContextSourceRef[];
};

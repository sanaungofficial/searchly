export type InboxStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  provider: string | null;
  agentEnabled?: boolean;
  autoApplyUpdates?: boolean;
};

export type Folder = { id: string; name: string; unread_count?: number };

export type MessageActivityMeta = {
  id: string;
  signal: string;
  status: string;
  userTag: "needs_follow_up" | "answered" | "potential" | "waiting" | null;
  companyGuess: string | null;
  roleGuess: string | null;
  job: { id: string; company: string; role: string; stage: string } | null;
};

export type MessageSummary = {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  fromName?: string;
  fromEmail?: string | null;
  avatar?: { primary: string | null; fallback: string | null; initials: string };
  dateLabel: string;
  unread: boolean;
  starred?: boolean;
  threadId?: string | null;
  attachmentCount?: number;
  activity?: MessageActivityMeta | null;
};

export type AttachmentMeta = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
};

export type MessageDetail = MessageSummary & {
  to: string;
  cc: string;
  bodyHtml: string | null;
  bodyText: string;
  attachments: AttachmentMeta[];
  thread: MessageSummary[];
};

export type ComposeState = {
  open: boolean;
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
};

/** @deprecated Chat-only — single inbox lens for now */
export type InboxLens = "job_search";

/** @deprecated Chat-only insights — kept for drawer types */
export type ActivitySummary = {
  id: string;
  source: string;
  signal: string;
  status: string;
  suggestedStage: string | null;
  appliedStage: string | null;
  confidence: number | null;
  title: string | null;
  snippet: string | null;
  companyGuess: string | null;
  roleGuess: string | null;
  interviewAt: string | null;
  nylasMessageId: string | null;
  nylasEventId: string | null;
  createdAt: string;
  job: { id: string; company: string; role: string; stage: string } | null;
};

export type PipelineJob = {
  id: string;
  company: string;
  role: string;
  stage: string;
};

export function signalLabel(signal: string): string {
  return signal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

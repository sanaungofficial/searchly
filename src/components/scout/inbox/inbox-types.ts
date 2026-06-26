export type InboxStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  provider: string | null;
  agentEnabled: boolean;
  autoApplyUpdates: boolean;
};

export type InboxMode = "mail" | "agent";

export type Folder = { id: string; name: string; unread_count?: number };

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

export type MessageActivity = {
  id: string;
  signal: string;
  status: string;
  suggestedStage: string | null;
  appliedStage?: string | null;
  confidence: number;
  title: string | null;
  snippet: string | null;
  companyGuess: string | null;
  roleGuess: string | null;
  interviewAt?: string | null;
  job: { id: string; company: string; role: string; stage: string } | null;
};

export type MessageSummary = {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  dateLabel: string;
  unread: boolean;
  starred?: boolean;
  threadId?: string | null;
  attachmentCount?: number;
  activity: MessageActivity | null;
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
  activity: MessageActivity | null;
};

export type PipelineJob = {
  id: string;
  company: string;
  role: string;
  stage: string;
};

export type CalendarEventRow = {
  id: string;
  title: string;
  location: string | null;
  startAt: string | null;
  startLabel: string;
  activity: {
    id: string;
    signal: string;
    status: string;
    suggestedStage: string | null;
    job: { id: string; company: string; role: string; stage: string } | null;
  } | null;
};

export type InterviewPrep = {
  talkingPoints: string[];
  questionsToAsk: string[];
  researchTips: string[];
  openingLine: string;
};

export type ComposeState = {
  open: boolean;
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
};

export function signalLabel(signal: string): string {
  return signal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

import { tool } from "ai";
import { z } from "zod";
import {
  executeMailTool,
  mailDraftReply,
  mailGetMessage,
  mailListCalendar,
  mailListRecent,
  mailSend,
  mailUpdateJobStage,
} from "@/lib/kimchi-assistant/mail/executor";

const MAIL_TOOL_PATTERN =
  /\b(inbox|email|e-mail|recruiter|reply|replies|send(?:ing)?|calendar|interview schedule|follow[- ]?up email|draft(?:ing)?|nylas|mailbox|unread|message thread)\b/i;

/** Only attach mail tools when the user is clearly asking about inbox/calendar — keeps general chat fast. */
export function wantsMailTools(messages: Array<{ role: string; content: string }>): boolean {
  const recentUser = messages
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content)
    .join("\n");
  return MAIL_TOOL_PATTERN.test(recentUser);
}

export function buildKimchiMailTools(userId: string) {
  return {
    list_recent_emails: tool({
      description:
        "List recent emails from the user's connected job-search inbox. Default limit 5. Summarize results for the user — do not read full bodies aloud.",
      inputSchema: z.object({
        limit: z.number().min(1).max(20).optional(),
        query: z.string().optional(),
      }),
      execute: async ({ limit, query }) => {
        const res = await mailListRecent(userId, { limit: limit ?? 5, query });
        return res.ok ? res.data : { error: res.error };
      },
    }),
    get_email: tool({
      description: "Fetch one email by Nylas message id for full context before drafting or advising.",
      inputSchema: z.object({ messageId: z.string() }),
      execute: async ({ messageId }) => {
        const res = await mailGetMessage(userId, messageId);
        return res.ok ? res.data : { error: res.error };
      },
    }),
    draft_email_reply: tool({
      description:
        "Draft a reply to an email. Returns to, subject, body — show the user and confirm before calling send_email.",
      inputSchema: z.object({
        messageId: z.string(),
        instructions: z.string().optional(),
      }),
      execute: async ({ messageId, instructions }) => {
        const res = await mailDraftReply(userId, { messageId, instructions });
        return res.ok ? res.data : { error: res.error };
      },
    }),
    send_email: tool({
      description:
        "Send an email from the user's connected inbox. Only call after the user explicitly confirms to/subject/body.",
      inputSchema: z.object({
        to: z.string(),
        subject: z.string(),
        body: z.string(),
        replyToMessageId: z.string().optional(),
      }),
      execute: async (input) => {
        const res = await mailSend(userId, input);
        return res.ok ? res.data : { error: res.error };
      },
    }),
    list_calendar_events: tool({
      description: "List upcoming calendar events from the connected account (interviews, meetings).",
      inputSchema: z.object({ daysAhead: z.number().min(1).max(30).optional() }),
      execute: async ({ daysAhead }) => {
        const res = await mailListCalendar(userId, daysAhead ?? 14);
        return res.ok ? res.data : { error: res.error };
      },
    }),
    update_job_stage: tool({
      description: "Update a pipeline job stage after the user agrees.",
      inputSchema: z.object({
        jobId: z.string(),
        stage: z.enum([
          "SAVED",
          "APPLYING",
          "APPLIED",
          "SCREENING",
          "INTERVIEWING",
          "OFFER",
          "REJECTED",
          "WITHDRAWN",
        ]),
      }),
      execute: async ({ jobId, stage }) => {
        const res = await mailUpdateJobStage(userId, jobId, stage);
        return res.ok ? res.data : { error: res.error };
      },
    }),
    open_app_page: tool({
      description:
        "Send the user to an in-app page when they need UI you cannot handle in chat (e.g. full resume editor).",
      inputSchema: z.object({
        route: z.string(),
        reason: z.string().optional(),
      }),
      execute: async ({ route, reason }) => ({ navigateTo: route, reason: reason ?? null }),
    }),
  };
}

export { executeMailTool };

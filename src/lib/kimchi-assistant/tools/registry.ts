/** Client-side voice tools — mail execution via POST /api/assistant/mail */

export const WORKSPACE_READ_TOOLS = [
  {
    name: "finish_voice_chat",
    description:
      "End the voice conversation when the user is clearly done — they said thanks, goodbye, that's all, I'm good, or similar. Call after a brief warm sign-off.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "One sentence summarizing what you covered together.",
        },
      },
      required: ["summary"],
    },
  },
  {
    name: "suggest_next_actions",
    description:
      "Get fresh proactive suggestions based on the user's pipeline and profile. Call when they ask what to do next or when you want to recommend priorities.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "open_ui_route",
    description:
      "Navigate the user to a relevant in-app screen. Use when they want to open their pipeline, profile, a job, inbox, or coaching.",
    parameters: {
      type: "object",
      properties: {
        route: {
          type: "string",
          description:
            "App path, e.g. /profile, /opportunities/pipeline, /inbox, /dashboard, /coaching",
        },
        label: { type: "string", description: "Short label for what you're opening (optional)." },
      },
      required: ["route"],
    },
  },
  {
    name: "list_recent_emails",
    description:
      "List recent emails from the user's connected inbox. Keep limit at 5 for voice — summarize, don't read each message verbatim.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max messages, default 5" },
        query: { type: "string", description: "Optional search query" },
      },
    },
  },
  {
    name: "get_email",
    description: "Fetch one email by message id before drafting or giving detailed advice.",
    parameters: {
      type: "object",
      properties: { messageId: { type: "string" } },
      required: ["messageId"],
    },
  },
  {
    name: "draft_email_reply",
    description:
      "Draft a reply to an email. Read back the draft and get explicit confirmation before send_email.",
    parameters: {
      type: "object",
      properties: {
        messageId: { type: "string" },
        instructions: { type: "string", description: "Optional tone or content guidance" },
      },
      required: ["messageId"],
    },
  },
  {
    name: "send_email",
    description:
      "Send email from the user's inbox. ONLY after reading back to, subject, and body and the user says yes.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        replyToMessageId: { type: "string", description: "Optional when replying to a thread" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "list_calendar_events",
    description: "List upcoming calendar events (interviews, meetings). Summarize for voice.",
    parameters: {
      type: "object",
      properties: { daysAhead: { type: "number", description: "Days to look ahead, default 14" } },
    },
  },
  {
    name: "update_job_stage",
    description: "Update a pipeline job stage when the user confirms.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        stage: {
          type: "string",
          enum: ["SAVED", "APPLYING", "APPLIED", "SCREENING", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"],
        },
      },
      required: ["jobId", "stage"],
    },
  },
] as const;

export const MAIL_VOICE_TOOL_NAMES = new Set([
  "list_recent_emails",
  "get_email",
  "draft_email_reply",
  "send_email",
  "list_calendar_events",
  "update_job_stage",
]);

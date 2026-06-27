/** Client-side voice tools — executed via POST /api/assistant/voice-tools and /api/assistant/mail */

export const VOICE_RESEARCH_TOOLS = [
  {
    name: "refresh_context",
    description:
      "Reload the user's profile, pipeline, watchlist, and strategy from the database. Call after they say they updated something, or before deep prep if context may be stale.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_job_detail",
    description:
      "Load a pipeline job by id: stage, fit score, notes, posting excerpt, and interview format inference. Use for interview prep and 'why this role' questions. Always confirm interviewInference.confirmQuestion with the user before drilling.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job id from pipeline context" },
        parsePosting: {
          type: "boolean",
          description: "Fetch/parse job URL if saved (default true). Set false to skip credits.",
        },
      },
      required: ["jobId"],
    },
  },
  {
    name: "parse_job_posting",
    description: "Fetch and parse a job posting URL (or job's saved URL via jobId). Uses credits.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        url: { type: "string", description: "Job posting URL if not using jobId" },
      },
    },
  },
  {
    name: "get_company_brief",
    description:
      "Load a target company from the watchlist: priority, candidate edge, intel, cached open roles. Cite as 'your target companies watchlist'.",
    parameters: {
      type: "object",
      properties: {
        companyId: { type: "string" },
        companyName: { type: "string", description: "Fuzzy match if id unknown" },
      },
    },
  },
  {
    name: "scan_company_roles",
    description:
      "Refresh open roles at a tracked company (Hirebase scan). Uses credits/time — ask user before scanning.",
    parameters: {
      type: "object",
      properties: { companyId: { type: "string" } },
      required: ["companyId"],
    },
  },
  {
    name: "save_job_note",
    description:
      "Save interview prep notes or voice insights to a pipeline job's user notes. Summarize what you're saving before calling.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        note: { type: "string" },
        mode: { type: "string", enum: ["append", "replace"], description: "Default append" },
      },
      required: ["jobId", "note"],
    },
  },
] as const;

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

export const VOICE_RESEARCH_TOOL_NAMES = new Set<string>(VOICE_RESEARCH_TOOLS.map((t) => t.name));

export const VOICE_TOOL_NAMES = new Set([
  ...VOICE_RESEARCH_TOOL_NAMES,
  "finish_voice_chat",
  "suggest_next_actions",
  "open_ui_route",
  ...MAIL_VOICE_TOOL_NAMES,
]);

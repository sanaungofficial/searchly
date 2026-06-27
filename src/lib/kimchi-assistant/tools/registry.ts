/** Client-side voice tools — executed via POST /api/assistant/voice-tools and /api/assistant/mail */

export const VOICE_RESEARCH_TOOLS = [
  {
    name: "list_active_roles",
    description:
      "List roles the user is applying to or interviewing for. Call when they haven't named ONE specific role yet, or when multiple roles might match. Read company + role names aloud and ask which one — never pick for them. Do not call get_job_detail until they choose.",
    parameters: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["interviewing", "applied", "all"],
          description: "Default interviewing for prep; applied for follow-ups; all when unclear",
        },
      },
    },
  },
  {
    name: "refresh_context",
    description:
      "Reload what you know about the user after they say they updated their profile, resume, or added a role. Do not call proactively.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_job_detail",
    description:
      "Load details for ONE role they already picked (jobId required). Returns fit notes and interview format hints. Only call after they confirm which role — never call for multiple roles. Confirm interview format aloud before drilling.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Internal id from list_active_roles — never say aloud" },
        parsePosting: {
          type: "boolean",
          description: "Pull job listing from saved URL. Default false — ask first unless they already said yes.",
        },
      },
      required: ["jobId"],
    },
  },
  {
    name: "parse_job_posting",
    description:
      "Pull text from a job listing URL. Ask permission first ('Want me to pull up that listing?'). Only call after they say yes.",
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
      "Load notes about ONE company they're tracking. If multiple companies could match, ask which one first.",
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
      "Check what's currently open at a tracked company. Ask first ('Want me to see what's open there?') — do not call without permission.",
    parameters: {
      type: "object",
      properties: { companyId: { type: "string" } },
      required: ["companyId"],
    },
  },
  {
    name: "save_job_note",
    description:
      "Save prep notes to ONE role they confirmed. Summarize what you'll save and ask 'Want me to jot that down?' before calling.",
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
      "Get fresh suggestions based on what you know about the user. Call when they ask what to do next — summarize briefly, don't read a long list.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "open_ui_route",
    description:
      "Open a screen in the app when they ask (profile, applications, inbox, etc.). Say what you're opening in plain language.",
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
    description:
      "Move ONE application to a new stage after the user confirms which role and the new stage.",
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

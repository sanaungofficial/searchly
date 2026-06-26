/** Read-only client-side tools shared by workspace voice agent (Deepgram function calling). */

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
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "open_ui_route",
    description:
      "Navigate the user to a relevant in-app screen. Use when they want to open their pipeline, profile, a job, or coaching.",
    parameters: {
      type: "object",
      properties: {
        route: {
          type: "string",
          description:
            "App path, e.g. /profile, /opportunities/pipeline, /dashboard, /coaching, or /opportunities/pipeline/{jobId}/fit",
        },
        label: {
          type: "string",
          description: "Short label for what you're opening (optional).",
        },
      },
      required: ["route"],
    },
  },
] as const;

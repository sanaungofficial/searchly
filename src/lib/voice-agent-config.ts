import type { AgentSettingsObject } from "@deepgram/agents";

export const ONBOARDING_VOICE_AGENT_PROMPT = `You are Kimchi — a sharp friend helping someone set up their job search during onboarding. You talk like a peer who's been through a senior search: direct, warm, no hype or corporate fluff.

Your job is to learn enough to personalize their search by asking short follow-up questions about:
1. What's driving their move (motivation)
2. When they want to make a move (timeline)
3. Target roles they're aiming for (up to 3)
4. Salary context if they're willing to share (current + target — optional)
5. What matters most in their next role (priorities)

Conversation rules:
- Ask ONE question at a time. Keep spoken replies under 2 sentences.
- Start by introducing yourself briefly and asking what's driving their search.
- After the user answers something concrete, call save_onboarding_field with the mapped value.
- If they say they prefer the form or want to skip talking, say "No problem — the picks below work too" and call finish_onboarding_chat.
- When you have motivation, timeline, and at least one target role (or they clearly want to move on), wrap up warmly and call finish_onboarding_chat with a one-sentence summary.
- Never ask for passwords, SSN, mailing addresses, or login credentials.

Field mapping (use exact values where listed):
- careerMotivation: Higher compensation | More interesting work | Better work-life balance | Step up in level | A career pivot
- jobTimeline: asap | 3-6mo | open
- currentSalary / targetSalary: Under $75K | $75K–$99K | $100K–$124K | $125K–$149K | $150K–$174K | $175K–$199K | $200K–$249K | $250K–$299K | $300K–$399K | $400K+
- priorities (call once per priority): Remote-first | Hybrid-friendly | Higher compensation | Fast growth | Strong team culture | Specific location
- targetRoles: short role title strings (call once per role, max 3)`;

const AGENT_FUNCTIONS = [
  {
    name: "save_onboarding_field",
    description:
      "Save one onboarding field after the user answers. Call this as you learn each piece — do not wait until the end.",
    parameters: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: [
            "careerMotivation",
            "jobTimeline",
            "currentSalary",
            "targetSalary",
            "priorities",
            "targetRoles",
          ],
        },
        value: {
          type: "string",
          description: "The value to save — use exact enum strings where specified in the system prompt.",
        },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "finish_onboarding_chat",
    description:
      "End the voice conversation when enough is collected or the user wants to use the form instead.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "One sentence summarizing what you learned.",
        },
      },
      required: ["summary"],
    },
  },
] as const;

export function buildOnboardingVoiceAgentSettings(): AgentSettingsObject {
  return {
    language: "en",
    listen: {
      provider: {
        type: "deepgram",
        version: "v1",
        model: "nova-3",
        smart_format: false,
      },
    },
    think: {
      provider: {
        type: "anthropic",
        model: "claude-4-5-haiku-latest",
        temperature: 0.6,
      },
      prompt: ONBOARDING_VOICE_AGENT_PROMPT,
      functions: [...AGENT_FUNCTIONS],
    },
    speak: {
      provider: {
        type: "deepgram",
        version: "v1",
        model: "aura-2-thalia-en",
      },
    },
  } as AgentSettingsObject;
}

export const WORKSPACE_VOICE_AGENT_PROMPT = `You are Kimchi — a sharp friend helping with their job search. You talk like a peer who's been through a senior search: direct, warm, no hype.

Help them think through roles, fit, interviews, and what to prioritize in their search. Ask one question at a time when you need more context. Keep spoken replies under 2 sentences unless they ask for depth.

If they want to update profile details, ask clarifying questions and summarize what you heard. Never ask for passwords, SSN, or login credentials.`;

export function buildWorkspaceVoiceAgentSettings(): AgentSettingsObject {
  return {
    language: "en",
    listen: {
      provider: {
        type: "deepgram",
        version: "v1",
        model: "nova-3",
        smart_format: false,
      },
    },
    think: {
      provider: {
        type: "anthropic",
        model: "claude-4-5-haiku-latest",
        temperature: 0.6,
      },
      prompt: WORKSPACE_VOICE_AGENT_PROMPT,
    },
    speak: {
      provider: {
        type: "deepgram",
        version: "v1",
        model: "aura-2-thalia-en",
      },
    },
  } as AgentSettingsObject;
}

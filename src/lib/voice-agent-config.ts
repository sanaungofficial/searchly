import type { AgentSettingsObject } from "@deepgram/agents";
import { buildPresetVoicePrompt } from "@/lib/kimchi-assistant/prompts";
import type { AssistantContextPayload } from "@/lib/kimchi-assistant/types";
import { isVoicePresetId, type VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";
import { WORKSPACE_READ_TOOLS } from "@/lib/kimchi-assistant/tools/registry";

/**
 * Deepgram-managed LLM for Voice Agent think step.
 * Use IDs from GET https://agent.deepgram.com/v1/agent/settings/think/models
 * gpt-4o-mini is Standard tier and most widely available on Voice Agent plans.
 */
export const VOICE_AGENT_THINK_PROVIDER = {
  type: "open_ai" as const,
  model: "gpt-4o-mini",
  temperature: 0.5,
};

const VOICE_AGENT_LISTEN = {
  provider: {
    type: "deepgram" as const,
    model: "nova-3",
  },
};

const VOICE_AGENT_SPEAK = {
  provider: {
    type: "deepgram" as const,
    model: "aura-2-thalia-en",
  },
};

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
    listen: VOICE_AGENT_LISTEN,
    think: {
      provider: VOICE_AGENT_THINK_PROVIDER,
      prompt: ONBOARDING_VOICE_AGENT_PROMPT,
      functions: [...AGENT_FUNCTIONS],
    },
    speak: VOICE_AGENT_SPEAK,
  } as AgentSettingsObject;
}

const WORKSPACE_VOICE_FALLBACK_PROMPT = `You are Kimchi — a senior career coach for PM, strategy, and ops leaders. Diagnose before you prescribe: ask sharp questions first, give specific advice only when you understand their situation or they explicitly ask what to do.

On your first reply after the user speaks: acknowledge their ask, say you're looking at what you know about them (profile/pipeline), cite one specific detail if you have it, then ask one sharp question. First reply may be 2–3 short sentences.

Never open with action lists or generic tips ("network more", "tailor your resume"). One expert diagnostic question per turn after the first reply. Spoken replies under 2 sentences unless they ask for depth.

You can read their inbox, draft replies, send mail (only after explicit confirmation), check calendar, and update pipeline stages via tools.

Voice rules for email: list at most 5 messages, summarize don't read verbatim, confirm before send.

Never ask for passwords, SSN, or login credentials.`;

export async function buildWorkspaceVoiceAgentSettings(
  assistantContext?: AssistantContextPayload | null,
  presetId: VoicePresetId = "general",
): Promise<AgentSettingsObject> {
  const prompt = assistantContext
    ? await buildPresetVoicePrompt(presetId, assistantContext)
    : WORKSPACE_VOICE_FALLBACK_PROMPT;

  return {
    language: "en",
    listen: VOICE_AGENT_LISTEN,
    think: {
      provider: VOICE_AGENT_THINK_PROVIDER,
      prompt,
      functions: [...WORKSPACE_READ_TOOLS],
    },
    speak: VOICE_AGENT_SPEAK,
  } as AgentSettingsObject;
}

export function resolveVoicePresetId(raw: string | null): VoicePresetId {
  return raw && isVoicePresetId(raw) ? raw : "general";
}

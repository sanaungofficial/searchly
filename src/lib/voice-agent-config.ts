import type { AgentSettingsObject } from "@deepgram/agents";
import { buildPresetVoicePrompt } from "@/lib/kimchi-assistant/prompts";
import type { AssistantContextPayload } from "@/lib/kimchi-assistant/types";
import { isVoicePresetId, type VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";
import { WORKSPACE_READ_TOOLS } from "@/lib/kimchi-assistant/tools/registry";
import {
  buildOnboardingCoachPrompt,
  ONBOARDING_VOICE_AGENT_PROMPT,
  type OnboardingCoachContext,
} from "@/lib/onboarding-coach/voice-prompt";

export type { OnboardingCoachContext } from "@/lib/onboarding-coach/voice-prompt";
export { buildOnboardingCoachPrompt, ONBOARDING_VOICE_AGENT_BASE } from "@/lib/onboarding-coach/voice-prompt";

/**
 * Deepgram-managed LLM for Voice Agent think step.
 * Use IDs from GET https://agent.deepgram.com/v1/agent/settings/think/models
 * gpt-4o-mini is Standard tier and most widely available on Voice Agent plans.
 */
export const VOICE_AGENT_THINK_PROVIDER = {
  type: "open_ai" as const,
  model: "gpt-4o-mini",
  temperature: 0.6,
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

const ONBOARDING_AGENT_FUNCTIONS = [
  {
    name: "propose_onboarding_answer",
    description:
      "Propose the user's answer for the CURRENT onboarding question. Shows a confirm card — does not save until they confirm.",
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
          description: "Mapped value — use exact enum strings where specified.",
        },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "confirm_onboarding_answer",
    description: "User confirmed the proposed answer on screen. Advance to the next question.",
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
      },
      required: ["field"],
    },
  },
  {
    name: "save_onboarding_field",
    description: "Alias for propose_onboarding_answer — propose a value for confirm.",
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
        value: { type: "string" },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "propose_onboarding_company",
    description: "Propose a company name for the user's watchlist. Shows confirm card before adding.",
    parameters: {
      type: "object",
      properties: {
        companyName: { type: "string", description: "Company name as the user said it." },
      },
      required: ["companyName"],
    },
  },
  {
    name: "confirm_onboarding_company",
    description: "User confirmed the proposed company on screen.",
    parameters: {
      type: "object",
      properties: {
        companyName: { type: "string" },
      },
      required: ["companyName"],
    },
  },
  {
    name: "finish_onboarding_chat",
    description: "User wants to stop talking and use the form picks instead.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
      },
      required: ["summary"],
    },
  },
] as const;

export function buildOnboardingVoiceAgentSettings(coach?: OnboardingCoachContext | null): AgentSettingsObject {
  const prompt = coach ? buildOnboardingCoachPrompt(coach) : ONBOARDING_VOICE_AGENT_PROMPT;
  return {
    language: "en",
    listen: VOICE_AGENT_LISTEN,
    think: {
      provider: VOICE_AGENT_THINK_PROVIDER,
      prompt,
      functions: [...ONBOARDING_AGENT_FUNCTIONS],
    },
    speak: VOICE_AGENT_SPEAK,
  } as AgentSettingsObject;
}

const WORKSPACE_VOICE_FALLBACK_PROMPT = `You are Kimchi — a sharp friend helping with their job search. You talk like a peer who's been through a senior search: direct, warm, no hype.

Help them think through roles, fit, interviews, mail, and scheduling. Ask one question at a time when you need more context. Keep spoken replies under 2 sentences unless they ask for depth.

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

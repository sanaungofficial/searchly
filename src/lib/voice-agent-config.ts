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

export type OnboardingCoachContext = {
  stepId: string;
  field: string;
  question: string;
  hint?: string;
  kind?: string;
  stepIndex: number;
  stepTotal: number;
  multiCount?: number;
  multiMax?: number;
};

export const ONBOARDING_VOICE_AGENT_BASE = `You are Kimchi — a sharp friend helping someone set up their job search during onboarding. Direct, warm, no hype.

Field mapping (use exact values where listed):
- careerMotivation: Higher compensation | More interesting work | Better work-life balance | Step up in level | A career pivot
- jobTimeline: asap | 3-6mo | open
- currentSalary / targetSalary: Under $75K | $75K–$99K | $100K–$124K | $125K–$149K | $150K–$174K | $175K–$199K | $200K–$249K | $250K–$299K | $300K–$399K | $400K+
- priorities (one per call): Remote-first | Hybrid-friendly | Higher compensation | Fast growth | Strong team culture | Specific location
- targetRoles: short role title strings (max 3)
- company: employer name for their watchlist (use propose_onboarding_company / confirm_onboarding_company)

Never ask for passwords, SSN, mailing addresses, or login credentials.`;

export function buildOnboardingCoachPrompt(ctx: OnboardingCoachContext): string {
  const isCompany = ctx.kind === "company" || ctx.field === "company";
  const isMulti = ctx.kind === "multi_add" || ctx.kind === "company";
  const multiNote =
    isMulti && ctx.multiMax
      ? `\nMulti-add step: ${ctx.multiCount ?? 0} of ${ctx.multiMax} added so far. After each confirm, ask if they want another unless at the max.`
      : "";

  const proposeRule = isCompany
    ? `- When they name a company, call propose_onboarding_company with companyName — do NOT advance on your own.`
    : `- When they answer, call propose_onboarding_answer with field="${ctx.field}" and the mapped value — do NOT advance on your own.`;

  const confirmRule = isCompany
    ? `- After proposing, ask briefly if that company looks right. If they say yes / correct / that's right, call confirm_onboarding_company with the same companyName.`
    : `- After proposing, ask briefly if that looks right. If they say yes / correct / that's right, call confirm_onboarding_answer for field="${ctx.field}".`;

  return `${ONBOARDING_VOICE_AGENT_BASE}

You are on onboarding step ${ctx.stepIndex + 1} of ${ctx.stepTotal}.

CURRENT QUESTION (only ask about this until confirmed):
"${ctx.question}"
${ctx.hint ? `Hint for the user: ${ctx.hint}` : ""}
Active field key: ${ctx.field}${multiNote}

Conversation rules:
- Ask ONLY the current question. Keep spoken replies under 2 sentences.
- Wait for the user to speak first unless they just tapped the orb.
${proposeRule}
${confirmRule}
- If they say no or want to change it, ask what to change and propose again with the revised value.
- If they want to use the picks below or skip optional questions, say "No problem" and stay quiet — do not call confirm until they answer this question.
- Do not ask about other fields until this one is confirmed.`;
}

/** @deprecated legacy free-form onboarding voice */
export const ONBOARDING_VOICE_AGENT_PROMPT = `${ONBOARDING_VOICE_AGENT_BASE}

Your job is to learn enough to personalize their search. Ask one question at a time.
After the user answers, call propose_onboarding_answer. After they confirm, call confirm_onboarding_answer.`;

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

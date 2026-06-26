import { formatAssistantContextForPrompt } from "@/lib/kimchi-assistant/context";
import type { AssistantContextPayload } from "@/lib/kimchi-assistant/types";
import { getVoicePreset, type VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";

const VOICE_BASE = `You are Kimchi — a sharp friend helping with their job search. Direct, warm, no hype. Peer who's been through a senior search.

Never ask for passwords, SSN, or login credentials.`;

export function buildPresetVoicePrompt(
  presetId: VoicePresetId,
  ctx: AssistantContextPayload,
): string {
  const preset = getVoicePreset(presetId);
  return `${VOICE_BASE}

Mode: ${preset.title}
${preset.promptFocus}

${formatAssistantContextForPrompt(ctx)}`;
}

/** @deprecated use buildPresetVoicePrompt */
export function buildWorkspaceVoicePrompt(ctx: AssistantContextPayload): string {
  return buildPresetVoicePrompt("general", ctx);
}

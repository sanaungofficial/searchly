import { formatAssistantContextForPrompt } from "@/lib/kimchi-assistant/context";
import type { AssistantContextPayload } from "@/lib/kimchi-assistant/types";
import { getVoicePreset, type VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";
import { getPrompt, interpolate } from "@/lib/prompts";

const VOICE_BASE_FALLBACK = `You are Kimchi — a senior career coach for PM, strategy, and ops leaders. Diagnose before you prescribe: ask sharp questions first, give specific advice only when you understand their situation or they explicitly ask what to do. No generic job-search platitudes.

Never ask for passwords, SSN, or login credentials.`;

export async function loadVoicePresetFocus(presetId: VoicePresetId): Promise<string> {
  const preset = getVoicePreset(presetId);
  try {
    return await getPrompt(preset.promptKey);
  } catch {
    return preset.promptFocus;
  }
}

export async function buildPresetVoicePrompt(
  presetId: VoicePresetId,
  ctx: AssistantContextPayload,
): Promise<string> {
  const preset = getVoicePreset(presetId);
  const presetFocus = await loadVoicePresetFocus(presetId);
  try {
    const template = await getPrompt("KIMCHI_VOICE_SYSTEM");
    return interpolate(template, {
      presetTitle: preset.title,
      presetEmoji: preset.emoji,
      presetFocus,
      context: formatAssistantContextForPrompt(ctx),
    });
  } catch {
    return `${VOICE_BASE_FALLBACK}

Mode: ${preset.emoji} ${preset.title}
${presetFocus}

${formatAssistantContextForPrompt(ctx)}`;
  }
}

/** @deprecated use buildPresetVoicePrompt */
export async function buildWorkspaceVoicePrompt(ctx: AssistantContextPayload): Promise<string> {
  return buildPresetVoicePrompt("general", ctx);
}

import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import type { VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";
import { getVoicePreset } from "@/lib/kimchi-assistant/voice-presets";

export type DebriefActionType =
  | "append_strategy_intake"
  | "generate_career_strategy"
  | "open_inbox_activity"
  | "open_resume_editor"
  | "ask_in_chat";

/** @deprecated legacy stored actions */
export type LegacyDebriefActionType = "save_strategy_notes" | "open_inbox_peek";

export type DebriefAction = {
  id: string;
  label: string;
  type: DebriefActionType | LegacyDebriefActionType;
  payload?: Record<string, string>;
};

export type VoiceDebriefResult = {
  summary: string;
  bullets: string[];
  actions: DebriefAction[];
};

function presetActions(presetId: VoicePresetId): DebriefAction[] {
  switch (presetId) {
    case "search_plan":
      return [
        {
          id: "generate-strategy",
          label: "Build my career strategy doc",
          type: "generate_career_strategy",
        },
        {
          id: "add-intake",
          label: "Add to strategy intake",
          type: "append_strategy_intake",
        },
        {
          id: "continue-search",
          label: "Plan next steps in chat",
          type: "ask_in_chat",
          payload: { prompt: "Based on our voice chat, what should I focus on this week in my job search?" },
        },
      ];
    case "interview_prep":
      return [
        {
          id: "prep-checklist",
          label: "Turn this into a prep checklist",
          type: "ask_in_chat",
          payload: { prompt: "Turn our voice prep into a short checklist I can use before the interview." },
        },
        {
          id: "add-intake",
          label: "Save prep notes to strategy intake",
          type: "append_strategy_intake",
        },
      ];
    case "my_story":
      return [
        {
          id: "resume",
          label: "Work on my resume",
          type: "open_resume_editor",
        },
        {
          id: "add-intake",
          label: "Save story notes to strategy intake",
          type: "append_strategy_intake",
        },
      ];
    case "what_to_focus":
      return [
        {
          id: "inbox",
          label: "Review email updates",
          type: "open_inbox_activity",
        },
        {
          id: "focus-chat",
          label: "Help me prioritize",
          type: "ask_in_chat",
          payload: { prompt: "Given everything we discussed, what should I focus on first?" },
        },
      ];
    default:
      return [
        {
          id: "add-intake",
          label: "Add to strategy intake",
          type: "append_strategy_intake",
        },
        {
          id: "continue",
          label: "Keep chatting here",
          type: "ask_in_chat",
          payload: { prompt: "What should I do next based on our conversation?" },
        },
      ];
  }
}

function fallbackDebrief(presetId: VoicePresetId, transcript: string): VoiceDebriefResult {
  const preset = getVoicePreset(presetId);
  const lines = transcript.split("\n").filter((l) => l.trim());
  const summary =
    lines.length > 2
      ? `Wrapped up "${preset.title}" — here's what stood out. Use the buttons below to turn it into something useful.`
      : `Short "${preset.title}" chat — tap below to keep going or save what we covered.`;

  return { summary, bullets: [], actions: presetActions(presetId) };
}

export async function runVoiceDebrief(params: {
  userId: string;
  presetId: VoicePresetId;
  transcript: string;
}): Promise<VoiceDebriefResult> {
  const { presetId, transcript } = params;
  const preset = getVoicePreset(presetId);
  const allowed = presetActions(presetId);

  if (!isKimchiAiConfigured() || transcript.trim().length < 20) {
    return fallbackDebrief(presetId, transcript);
  }

  const allowedTypes = allowed.map((a) => a.type).join(", ");

  const prompt = `You debrief a voice conversation between a job seeker and Kimchi (${preset.title}).

Return ONLY valid JSON:
{
  "summary": "2-3 sentences, plain language, second person",
  "bullets": ["key point 1", "key point 2", ... max 5],
  "actions": [
    { "id": "unique", "label": "button label (short, friendly)", "type": "<one of allowed types>", "payload": {} }
  ]
}

Allowed action types for this preset ONLY: ${allowedTypes}

Rules:
- Pick 2-3 actions from the allowed list — use the preset-appropriate ones, not generic resume/inbox unless relevant
- append_strategy_intake: save conversation notes for career strategy (always include exactly one if allowed)
- generate_career_strategy: only for search_plan when they discussed goals, timeline, or search approach
- open_resume_editor: only for my_story preset when resume/positioning came up
- open_inbox_activity: only when emails, follow-ups, or applications were discussed
- ask_in_chat: optional; payload.prompt = user message to send Kimchi

Preset: ${preset.title}
Transcript:
${transcript.slice(0, 12000)}`;

  try {
    const { text } = await kimchiGenerateText({
      tier: "talk",
      prompt,
      maxOutputTokens: 800,
      userId: params.userId,
      tags: ["feature:voice-debrief"],
    });

    const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, "")) as VoiceDebriefResult;
    if (!parsed.summary || !Array.isArray(parsed.actions)) {
      return fallbackDebrief(presetId, transcript);
    }

    parsed.bullets = Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 5) : [];

    const allowedSet = new Set(allowed.map((a) => a.type));
    parsed.actions = parsed.actions.filter((a) => allowedSet.has(a.type as DebriefActionType));

    if (!parsed.actions.some((a) => a.type === "append_strategy_intake") && allowedSet.has("append_strategy_intake")) {
      const intake = allowed.find((a) => a.type === "append_strategy_intake");
      if (intake) parsed.actions.unshift(intake);
    }

    if (parsed.actions.length === 0) {
      return fallbackDebrief(presetId, transcript);
    }

    return parsed;
  } catch {
    return fallbackDebrief(presetId, transcript);
  }
}

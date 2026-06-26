import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import type { VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";
import { getVoicePreset } from "@/lib/kimchi-assistant/voice-presets";

export type DebriefAction = {
  id: string;
  label: string;
  type: "open_resume_editor" | "save_strategy_notes" | "open_inbox_peek" | "ask_in_chat";
  payload?: Record<string, string>;
};

export type VoiceDebriefResult = {
  summary: string;
  bullets: string[];
  actions: DebriefAction[];
};

function fallbackDebrief(presetId: VoicePresetId, transcript: string): VoiceDebriefResult {
  const preset = getVoicePreset(presetId);
  const lines = transcript.split("\n").filter((l) => l.trim());
  const summary =
    lines.length > 2
      ? `Wrapped up "${preset.title}" — ${lines.length} lines captured. Ask me anything about what you said.`
      : `Short "${preset.title}" chat — tap below if you want to keep going in text.`;

  const actions: DebriefAction[] = [
    {
      id: "save-notes",
      label: "Save this to my notes",
      type: "save_strategy_notes",
    },
  ];

  if (presetId === "my_story") {
    actions.unshift({
      id: "resume",
      label: "Work on my resume",
      type: "open_resume_editor",
    });
  }
  if (presetId === "what_to_focus" || presetId === "search_plan") {
    actions.unshift({
      id: "inbox",
      label: "See email updates",
      type: "open_inbox_peek",
    });
  }
  if (presetId === "interview_prep") {
    actions.unshift({
      id: "ask-prep",
      label: "Turn this into a prep checklist",
      type: "ask_in_chat",
      payload: { prompt: "Turn our voice prep into a short checklist I can use before the interview." },
    });
  }

  actions.push({
    id: "continue",
    label: "Keep chatting here",
    type: "ask_in_chat",
    payload: { prompt: "What should I do next based on our conversation?" },
  });

  return { summary, bullets: [], actions };
}

export async function runVoiceDebrief(params: {
  userId: string;
  presetId: VoicePresetId;
  transcript: string;
}): Promise<VoiceDebriefResult> {
  const { presetId, transcript } = params;
  const preset = getVoicePreset(presetId);

  if (!isKimchiAiConfigured() || transcript.trim().length < 20) {
    return fallbackDebrief(presetId, transcript);
  }

  const prompt = `You debrief a voice conversation between a job seeker and Kimchi (${preset.title}).

Return ONLY valid JSON:
{
  "summary": "2-3 sentences, plain language, second person",
  "bullets": ["key point 1", "key point 2", ... max 5],
  "actions": [
    { "id": "unique", "label": "button label (short, friendly)", "type": "open_resume_editor" | "save_strategy_notes" | "open_inbox_peek" | "ask_in_chat", "payload": {} }
  ]
}

Action rules:
- open_resume_editor: only if they discussed resume, positioning, or how they describe experience
- save_strategy_notes: always include exactly one
- open_inbox_peek: if they mentioned emails, follow-ups, or applications waiting
- ask_in_chat: optional follow-up; payload.prompt = user message to send

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
    if (!parsed.actions.some((a) => a.type === "save_strategy_notes")) {
      parsed.actions.push({
        id: "save-notes",
        label: "Save this to my notes",
        type: "save_strategy_notes",
      });
    }
    return parsed;
  } catch {
    return fallbackDebrief(presetId, transcript);
  }
}

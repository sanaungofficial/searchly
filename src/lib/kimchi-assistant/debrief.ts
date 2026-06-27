import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import type { VoicePresetId } from "@/lib/kimchi-assistant/voice-presets";
import { getVoicePreset } from "@/lib/kimchi-assistant/voice-presets";
import { getPrompt, interpolate } from "@/lib/prompts";

export type DebriefActionType =
  | "append_strategy_intake"
  | "generate_career_strategy"
  | "open_inbox_activity"
  | "open_resume_editor"
  | "open_pipeline_job"
  | "open_target_company"
  | "save_job_notes"
  | "ask_in_chat";

/** @deprecated legacy stored actions */
export type LegacyDebriefActionType = "save_strategy_notes" | "open_inbox_peek";

export type DebriefAction = {
  id: string;
  label: string;
  hint?: string;
  type: DebriefActionType | LegacyDebriefActionType;
  payload?: Record<string, string>;
};

export type VoiceDebriefResult = {
  summary: string;
  bullets: string[];
  actions: DebriefAction[];
};

export type DebriefContextHint = {
  focusedJobId?: string | null;
  pipelineJobs?: Array<{ id: string; company: string; role: string; stage?: string }>;
  contextSources?: Array<{ id: string; label: string; route: string }>;
};

function presetActions(presetId: VoicePresetId): DebriefAction[] {
  switch (presetId) {
    case "search_plan":
      return [
        {
          id: "generate-strategy",
          label: "Build my strategy doc",
          hint: "Turn this into a career strategy on Profile",
          type: "generate_career_strategy",
        },
        {
          id: "open-company",
          label: "Open target company",
          hint: "Watchlist intel and open roles",
          type: "open_target_company",
        },
        {
          id: "continue-search",
          label: "Plan my week in chat",
          hint: "Get a concrete next-step list here",
          type: "ask_in_chat",
          payload: { prompt: "Based on our voice chat, what should I focus on this week in my job search?" },
        },
        {
          id: "add-intake",
          label: "Save notes to Profile",
          hint: "Adds a block to your strategy intake",
          type: "append_strategy_intake",
        },
      ];
    case "interview_prep":
      return [
        {
          id: "open-job",
          label: "Open role in pipeline",
          hint: "Posting, fit score, and your notes",
          type: "open_pipeline_job",
        },
        {
          id: "save-job-notes",
          label: "Save prep notes to job",
          hint: "Appends session notes to the pipeline role",
          type: "save_job_notes",
        },
        {
          id: "prep-checklist",
          label: "Make a prep checklist",
          hint: "Short list you can use before the interview",
          type: "ask_in_chat",
          payload: { prompt: "Turn our voice prep into a short checklist I can use before the interview." },
        },
        {
          id: "add-intake",
          label: "Save prep notes to Profile",
          hint: "Keeps stories and angles for later",
          type: "append_strategy_intake",
        },
      ];
    case "my_story":
      return [
        {
          id: "resume",
          label: "Apply to my resume",
          hint: "Opens the resume editor with these notes",
          type: "open_resume_editor",
        },
        {
          id: "positioning-chat",
          label: "Polish my positioning",
          hint: "Turn this into a headline or intro in chat",
          type: "ask_in_chat",
          payload: { prompt: "Help me turn what we discussed into a crisp positioning line and 2–3 proof points." },
        },
        {
          id: "add-intake",
          label: "Save to Profile notes",
          hint: "Stores positioning notes on your profile",
          type: "append_strategy_intake",
        },
      ];
    case "what_to_focus":
      return [
        {
          id: "open-job",
          label: "Open priority role",
          hint: "Pipeline job we discussed",
          type: "open_pipeline_job",
        },
        {
          id: "focus-chat",
          label: "What's my #1 priority?",
          hint: "One clear next step in chat",
          type: "ask_in_chat",
          payload: { prompt: "Given everything we discussed, what should I focus on first — be specific." },
        },
        {
          id: "inbox",
          label: "Review inbox updates",
          hint: "See emails Kimchi flagged",
          type: "open_inbox_activity",
        },
      ];
    default:
      return [
        {
          id: "continue",
          label: "Keep going in chat",
          hint: "Pick up the thread here",
          type: "ask_in_chat",
          payload: { prompt: "What should I do next based on our conversation?" },
        },
        {
          id: "add-intake",
          label: "Save to Profile notes",
          hint: "Optional — only if you want to keep this",
          type: "append_strategy_intake",
        },
      ];
  }
}

function normalizeActions(parsed: DebriefAction[], allowed: DebriefAction[]): DebriefAction[] {
  const byType = new Map(allowed.map((a) => [a.type, a]));
  const seen = new Set<string>();
  const out: DebriefAction[] = [];

  for (const a of parsed) {
    const type = a.type as DebriefActionType;
    const canon = byType.get(type);
    if (!canon || seen.has(type)) continue;
    seen.add(type);
    out.push({
      ...canon,
      id: a.id || canon.id,
      payload: a.payload ?? canon.payload,
    });
  }

  for (const a of allowed) {
    if (out.length >= 3) break;
    if (!seen.has(a.type)) {
      seen.add(a.type);
      out.push(a);
    }
  }

  return out.slice(0, 3);
}

function fallbackDebrief(presetId: VoicePresetId, transcript: string): VoiceDebriefResult {
  const preset = getVoicePreset(presetId);
  const lines = transcript.split("\n").filter((l) => l.trim());
  const summary =
    lines.length > 2
      ? `Nice — here's what stood out from our ${preset.title.toLowerCase()} chat. Pick a next step below if you want to turn it into something.`
      : `Quick chat on ${preset.title.toLowerCase()}. Use the buttons below if you want to keep going.`;

  return { summary, bullets: [], actions: presetActions(presetId).slice(0, 2) };
}

export async function runVoiceDebrief(params: {
  userId: string;
  presetId: VoicePresetId;
  transcript: string;
  contextHint?: DebriefContextHint;
}): Promise<VoiceDebriefResult> {
  const { presetId, transcript, contextHint } = params;
  const preset = getVoicePreset(presetId);
  const allowed = presetActions(presetId);

  if (!isKimchiAiConfigured() || transcript.trim().length < 20) {
    return fallbackDebrief(presetId, transcript);
  }

  const allowedTypes = allowed.map((a) => a.type).join(", ");
  const allowedActionsJson = JSON.stringify(
    allowed.map((a) => ({ type: a.type, label: a.label, hint: a.hint })),
    null,
    2,
  );

  const contextBlock = contextHint
    ? `\nContext for action payloads (use exact ids when a specific job/company was discussed):
${contextHint.focusedJobId ? `- Focused job id: ${contextHint.focusedJobId}` : ""}
${
  contextHint.pipelineJobs?.length
    ? `- Pipeline jobs:\n${contextHint.pipelineJobs
        .slice(0, 12)
        .map((j) => `  · ${j.role} at ${j.company}${j.stage ? ` (${j.stage})` : ""} — id ${j.id}`)
        .join("\n")}`
    : ""
}
${
  contextHint.contextSources?.length
    ? `- Editable sources:\n${contextHint.contextSources
        .slice(0, 8)
        .map((s) => `  · ${s.label} → ${s.route}`)
        .join("\n")}`
    : ""
}`
    : "";

  const template = await getPrompt("KIMCHI_VOICE_DEBRIEF");
  const prompt = interpolate(template, {
    presetTitle: preset.title,
    allowedActionTypes: allowedTypes,
    allowedActionsJson,
    transcript: transcript.slice(0, 12000),
    contextBlock,
  });

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
    parsed.actions = normalizeActions(parsed.actions, allowed);

    if (parsed.actions.length === 0) {
      return fallbackDebrief(presetId, transcript);
    }

    return parsed;
  } catch {
    return fallbackDebrief(presetId, transcript);
  }
}

export function allowedDebriefActionsForPreset(presetId: VoicePresetId): DebriefAction[] {
  return presetActions(presetId);
}

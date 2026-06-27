/** Plain-language voice modes — UI metadata + admin prompt key mapping. */

export type VoicePresetId =
  | "search_plan"
  | "interview_prep"
  | "my_story"
  | "what_to_focus"
  | "general";

export type VoicePresetDefinition = {
  id: VoicePresetId;
  title: string;
  description: string;
  emoji: string;
  /** CSS color for accents (badges, borders) */
  accent: string;
  /** @deprecated loaded from admin prompt — kept as fallback */
  promptFocus: string;
  promptKey: string;
};

export const VOICE_PRESET_PROMPT_KEYS: Record<VoicePresetId, string> = {
  search_plan: "KIMCHI_VOICE_PRESET_SEARCH_PLAN",
  interview_prep: "KIMCHI_VOICE_PRESET_INTERVIEW_PREP",
  my_story: "KIMCHI_VOICE_PRESET_MY_STORY",
  what_to_focus: "KIMCHI_VOICE_PRESET_WHAT_TO_FOCUS",
  general: "KIMCHI_VOICE_PRESET_GENERAL",
};

export const VOICE_PRESETS: VoicePresetDefinition[] = [
  {
    id: "search_plan",
    title: "Plan my search",
    description: "Why you're looking, timeline, and what kind of role you want next.",
    emoji: "🗺️",
    accent: "#2D6A4F",
    promptKey: VOICE_PRESET_PROMPT_KEYS.search_plan,
    promptFocus: `Expert job search planning: uncover what's driving the move, timeline, and gaps before suggesting a plan. Ask diagnostic questions — one at a time. No generic tips or action lists until you understand their situation. Under 2 sentences per reply.`,
  },
  {
    id: "interview_prep",
    title: "Prep for an interview",
    description: "Stories to tell, gaps to address, and what to lead with.",
    emoji: "🎯",
    accent: "#BC6C25",
    promptKey: VOICE_PRESET_PROMPT_KEYS.interview_prep,
    promptFocus: `Expert interview prep: find out which interview, format, and worries first — then probe stories and gaps. Ask diagnostic questions, don't lecture with generic prep tips. One question at a time. Under 2 sentences per reply.`,
  },
  {
    id: "my_story",
    title: "Shape how I talk about myself",
    description: "Positioning, resume narrative, and how to describe your experience.",
    emoji: "✨",
    accent: "#7B2CBF",
    promptKey: VOICE_PRESET_PROMPT_KEYS.my_story,
    promptFocus: `Expert positioning coach: hear how they describe themselves today, probe what's undersold or fuzzy. Ask before rewriting their pitch. Reference their resume and profile. One question at a time. Under 2 sentences per reply.`,
  },
  {
    id: "what_to_focus",
    title: "What should I focus on?",
    description: "Sort what's stalled, what's hot, and what to do this week.",
    emoji: "⚡",
    accent: "#E09F3E",
    promptKey: VOICE_PRESET_PROMPT_KEYS.what_to_focus,
    promptFocus: `Expert prioritization: find what's stuck or creating drag before recommending one priority. Use pipeline and inbox data in your questions. No laundry lists — diagnose first. One question at a time. Under 2 sentences.`,
  },
  {
    id: "general",
    title: "Just talk it out",
    description: "Open conversation about your search — Kimchi will keep up.",
    emoji: "💬",
    accent: "#1A3A2F",
    promptKey: VOICE_PRESET_PROMPT_KEYS.general,
    promptFocus: `Open coaching conversation: clarify the real question behind what they said before advising. Ask like an expert who knows their file — no generic encouragement. One question at a time. Under 2 sentences unless they want depth.`,
  },
];

export function getVoicePreset(id: string | null | undefined): VoicePresetDefinition {
  return VOICE_PRESETS.find((p) => p.id === id) ?? VOICE_PRESETS.find((p) => p.id === "general")!;
}

export function isVoicePresetId(id: string): id is VoicePresetId {
  return VOICE_PRESETS.some((p) => p.id === id);
}

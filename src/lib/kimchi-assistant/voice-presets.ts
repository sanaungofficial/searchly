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
    promptFocus: `You're helping them clarify their job search plan: what's driving the move, timeline, target roles, and what matters in the next job. Ask one question at a time. Keep replies under 2 sentences.`,
  },
  {
    id: "interview_prep",
    title: "Prep for an interview",
    description: "Stories to tell, gaps to address, and what to lead with.",
    emoji: "🎯",
    accent: "#BC6C25",
    promptKey: VOICE_PRESET_PROMPT_KEYS.interview_prep,
    promptFocus: `You're helping them prepare for an upcoming interview. Ask which role or company if unclear. Focus on stories, strengths, likely gaps, and what to lead with. One question at a time. Under 2 sentences per reply.`,
  },
  {
    id: "my_story",
    title: "Shape how I talk about myself",
    description: "Positioning, resume narrative, and how to describe your experience.",
    emoji: "✨",
    accent: "#7B2CBF",
    promptKey: VOICE_PRESET_PROMPT_KEYS.my_story,
    promptFocus: `You're helping them shape how they describe their career — positioning, headline themes, resume narrative, and proof points. One question at a time. Under 2 sentences per reply.`,
  },
  {
    id: "what_to_focus",
    title: "What should I focus on?",
    description: "Sort what's stalled, what's hot, and what to do this week.",
    emoji: "⚡",
    accent: "#E09F3E",
    promptKey: VOICE_PRESET_PROMPT_KEYS.what_to_focus,
    promptFocus: `You're helping them decide what deserves attention right now — applications waiting on them, interviews coming up, emails to review, and what can wait. Reference their applications and inbox insights when available. One question at a time. Under 2 sentences.`,
  },
  {
    id: "general",
    title: "Just talk it out",
    description: "Open conversation about your search — Kimchi will keep up.",
    emoji: "💬",
    accent: "#1A3A2F",
    promptKey: VOICE_PRESET_PROMPT_KEYS.general,
    promptFocus: `Open conversation about their job search. Be direct and helpful. One question at a time when you need more context. Under 2 sentences unless they want depth.`,
  },
];

export function getVoicePreset(id: string | null | undefined): VoicePresetDefinition {
  return VOICE_PRESETS.find((p) => p.id === id) ?? VOICE_PRESETS.find((p) => p.id === "general")!;
}

export function isVoicePresetId(id: string): id is VoicePresetId {
  return VOICE_PRESETS.some((p) => p.id === id);
}

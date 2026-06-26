/** Plain-language voice modes — no internal jargon in user-facing copy. */

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
  promptFocus: string;
};

export const VOICE_PRESETS: VoicePresetDefinition[] = [
  {
    id: "search_plan",
    title: "Plan my search",
    description: "Why you're looking, timeline, and what kind of role you want next.",
    promptFocus: `You're helping them clarify their job search plan: what's driving the move, timeline, target roles, and what matters in the next job. Ask one question at a time. Keep replies under 2 sentences.`,
  },
  {
    id: "interview_prep",
    title: "Prep for an interview",
    description: "Stories to tell, gaps to address, and what to lead with.",
    promptFocus: `You're helping them prepare for an upcoming interview. Ask which role or company if unclear. Focus on stories, strengths, likely gaps, and what to lead with. One question at a time. Under 2 sentences per reply.`,
  },
  {
    id: "my_story",
    title: "Shape how I talk about myself",
    description: "Positioning, resume narrative, and how to describe your experience.",
    promptFocus: `You're helping them shape how they describe their career — positioning, headline themes, resume narrative, and proof points. One question at a time. Under 2 sentences per reply.`,
  },
  {
    id: "what_to_focus",
    title: "What should I focus on?",
    description: "Sort what's stalled, what's hot, and what to do this week.",
    promptFocus: `You're helping them decide what deserves attention right now — applications waiting on them, interviews coming up, emails to review, and what can wait. Reference their applications and inbox insights when available. One question at a time. Under 2 sentences.`,
  },
  {
    id: "general",
    title: "Just talk it out",
    description: "Open conversation about your search — Kimchi will keep up.",
    promptFocus: `Open conversation about their job search. Be direct and helpful. One question at a time when you need more context. Under 2 sentences unless they want depth.`,
  },
];

export function getVoicePreset(id: string | null | undefined): VoicePresetDefinition {
  return VOICE_PRESETS.find((p) => p.id === id) ?? VOICE_PRESETS.find((p) => p.id === "general")!;
}

export function isVoicePresetId(id: string): id is VoicePresetId {
  return VOICE_PRESETS.some((p) => p.id === id);
}

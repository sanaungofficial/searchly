import type { AssistantContextPayload, AssistantSuggestion } from "@/lib/kimchi-assistant/types";

export type ChatChip = {
  id: string;
  label: string;
  prompt: string;
};

const GENERIC_STARTERS: ChatChip[] = [
  {
    id: "plan-search",
    label: "Plan my job search",
    prompt: "Help me plan my job search for the next two weeks — what should I prioritize?",
  },
  {
    id: "focus-week",
    label: "What should I focus on?",
    prompt: "Given everything you know about me, what should I focus on this week?",
  },
  {
    id: "pipeline-review",
    label: "Review my pipeline",
    prompt: "Walk me through my pipeline — what's strong, what's stale, and what am I missing?",
  },
  {
    id: "story",
    label: "Shape how I talk about myself",
    prompt: "Help me shape how I talk about my experience in interviews and networking.",
  },
];

function suggestionToChip(s: AssistantSuggestion): ChatChip {
  let prompt = s.title;
  if (s.kind === "inbox_email") {
    prompt = `Help me decide what to do about this email: ${s.detail}`;
  } else if (s.kind === "follow_up") {
    prompt = `Help me follow up: ${s.title} — ${s.detail}`;
  } else if (s.detail) {
    prompt = `Help me with: ${s.title} — ${s.detail}`;
  }
  return { id: s.id, label: s.title, prompt };
}

/** Clickable starters for empty / new threads — context-aware when possible. */
export function buildStarterChips(ctx: AssistantContextPayload | null): ChatChip[] {
  const fromContext = (ctx?.suggestions ?? []).slice(0, 4).map(suggestionToChip);
  const seen = new Set(fromContext.map((c) => c.label));
  const extras = GENERIC_STARTERS.filter((c) => !seen.has(c.label));
  return [...fromContext, ...extras].slice(0, 5);
}

const TOPIC_RULES: Array<{ match: RegExp; chips: ChatChip[] }> = [
  {
    match: /follow[- ]?up|reach out|haven't heard|check in|nudge/i,
    chips: [
      { id: "draft-followup", label: "Draft a follow-up", prompt: "Draft a short follow-up I can send." },
      { id: "when-followup", label: "When should I follow up?", prompt: "When is the right time to follow up, and how often?" },
    ],
  },
  {
    match: /interview|prep|screen|hiring manager|panel/i,
    chips: [
      { id: "prep-checklist", label: "Give me a prep checklist", prompt: "Turn that into a short prep checklist I can use." },
      { id: "questions-ask", label: "Questions I should ask", prompt: "What smart questions should I ask them?" },
    ],
  },
  {
    match: /resume|bullet|position|frame|story|talk about/i,
    chips: [
      { id: "resume-bullet", label: "Help me write a bullet", prompt: "Help me turn that into a strong resume bullet." },
      { id: "tell-story", label: "How do I tell this story?", prompt: "How should I tell this story in an interview?" },
    ],
  },
  {
    match: /strategy|plan|priorit|focus|timeline|goal/i,
    chips: [
      { id: "first-step", label: "What's my first step?", prompt: "What's the single best first step based on what you just said?" },
      { id: "week-plan", label: "Plan my week", prompt: "Turn that into a plan for the next 7 days." },
    ],
  },
  {
    match: /apply|application|cover letter|tailor/i,
    chips: [
      { id: "apply-angle", label: "How should I apply?", prompt: "How should I angle my application for this role?" },
      { id: "cover-opener", label: "Cover letter opener", prompt: "Give me a strong opening paragraph for a cover letter." },
    ],
  },
  {
    match: /email|inbox|recruiter|reply/i,
    chips: [
      { id: "reply-draft", label: "Draft a reply", prompt: "Draft a reply I can send." },
      { id: "decode-email", label: "What does this mean?", prompt: "What are they really saying, and what should I do?" },
    ],
  },
  {
    match: /fit|match|qualif|gap|light on|missing/i,
    chips: [
      { id: "close-gap", label: "How do I close the gap?", prompt: "How can I close the biggest gap you mentioned?" },
      { id: "lead-with", label: "What should I lead with?", prompt: "What should I lead with when I talk about fit?" },
    ],
  },
];

const FALLBACK_DRILLDOWNS: ChatChip[] = [
  { id: "deeper", label: "Go deeper", prompt: "Go deeper on that — what am I missing?" },
  { id: "example", label: "Give me an example", prompt: "Can you give me a concrete example?" },
  { id: "next-step", label: "What's my next step?", prompt: "What's the single best next step for me?" },
  { id: "simpler", label: "Simplify that", prompt: "Can you simplify that into 3 bullet points?" },
];

/** Related drill-down chips after an assistant reply. */
export function buildFollowUpChips(params: {
  userMessage: string;
  assistantMessage: string;
}): ChatChip[] {
  const combined = `${params.userMessage}\n${params.assistantMessage}`;
  const out: ChatChip[] = [];
  const usedLabels = new Set<string>();

  for (const rule of TOPIC_RULES) {
    if (!rule.match.test(combined)) continue;
    for (const chip of rule.chips) {
      if (usedLabels.has(chip.label)) continue;
      usedLabels.add(chip.label);
      out.push(chip);
      if (out.length >= 4) return out;
    }
  }

  for (const chip of FALLBACK_DRILLDOWNS) {
    if (usedLabels.has(chip.label)) continue;
    usedLabels.add(chip.label);
    out.push(chip);
    if (out.length >= 3) break;
  }

  return out;
}

export const WELCOME_MESSAGE =
  "Hey — I'm Kimchi. Pick something below to get started, or type your own question.";

export function isWelcomeOnlyThread(
  messages: Array<{ kind: string; role?: string; content?: string }>,
): boolean {
  const textMsgs = messages.filter((m) => m.kind === "text");
  if (textMsgs.length === 0) return true;
  if (textMsgs.length === 1 && textMsgs[0].role === "assistant") {
    const c = textMsgs[0].content ?? "";
    return (
      c.includes("Talk it out") ||
      c.includes("pick something below") ||
      c.includes("Ask anything about your search")
    );
  }
  return false;
}

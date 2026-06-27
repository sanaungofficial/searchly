import type {
  AssistantContextPayload,
  AssistantProfileGaps,
  AssistantSuggestion,
} from "@/lib/kimchi-assistant/types";
import {
  filterSuggestionsForWelcome,
  isPromotionalInboxActivity,
  questionFromSuggestion,
} from "@/lib/kimchi-assistant/suggestion-questions";

export type ChipAction =
  | { type: "chat"; prompt: string }
  | { type: "navigate"; href: string }
  | { type: "open_resume" }
  | { type: "open_strategy" }
  | { type: "generate_strategy" }
  | { type: "inbox_insight"; activityId?: string }
  | { type: "add_skill"; skill: string }
  | { type: "show_recommendations" };

/** @deprecated use AssistantChip */
export type ChatChip = {
  id: string;
  label: string;
  prompt: string;
};

export type ChipTone = "violet" | "sky" | "amber" | "mint" | "rose" | "neutral";

export type AssistantChip = {
  id: string;
  label: string;
  hint?: string;
  variant: "action" | "chat";
  tone?: ChipTone;
  action: ChipAction;
};

export const CHIP_PAGE_GUIDANCE: Record<string, string> = {
  "/profile/assets":
    "Taking you to **Profile → Assets**. Upload your master resume or edit the one you have — Kimchi tailors from this for every application.",
  "/profile/career-strategy":
    "Opening **Career strategy**. Review your goals doc or generate a new one — that's the north star for your search.",
  "/profile/learning-path":
    "Opening **Upskill**. Pick a course or next step for the skill you queued.",
  "/opportunities/pipeline":
    "Opening your **pipeline**. Add roles you're tracking or move cards forward as things progress.",
  "/inbox":
    "Opening **Inbox**. Connect email if you haven't — Kimchi can summarize recruiter threads and draft replies.",
};

export function chipNavigateHref(chip: AssistantChip): string | null {
  switch (chip.action.type) {
    case "navigate":
      return chip.action.href;
    case "open_strategy":
      return "/profile/career-strategy";
    case "open_resume":
      return "/profile/assets";
    default:
      return null;
  }
}

export function guidanceForChip(chip: AssistantChip): string | null {
  const href = chipNavigateHref(chip);
  if (href && CHIP_PAGE_GUIDANCE[href]) return CHIP_PAGE_GUIDANCE[href];
  if (chip.action.type === "add_skill") {
    return `Added **${chip.action.skill}** to your Upskill path — pick a course or next step on that page.`;
  }
  return chip.hint ?? null;
}

export const NEW_THREAD_TITLE = "New thread";

export type KnowsYouPreview = {
  headline: string;
  details: string[];
};

function strategyTargetRoles(ctx: AssistantContextPayload | null | undefined): string | null {
  return ctx?.strategySnippet.match(/Target roles: ([^\n]+)/)?.[1]?.trim() ?? null;
}

function firstPipelineRole(ctx: AssistantContextPayload | null | undefined): string | null {
  const line = ctx?.pipelineSnippet.match(/^- (.+?) \(/m)?.[1];
  if (!line) return null;
  return line.split(" at ")[0]?.trim() ?? line;
}

function expandStrategyChip(ctx?: AssistantContextPayload | null): AssistantChip {
  const target = strategyTargetRoles(ctx);
  return {
    id: "expand-strategy",
    label: "What should I sharpen in my strategy?",
    variant: "chat",
    tone: "violet",
    action: {
      type: "chat",
      prompt: target
        ? `Based on my career strategy and targeting ${target}, what should I sharpen or add this week?`
        : "Based on my career strategy, what should I expand or sharpen this week?",
    },
  };
}

function openStrategyChip(ctx?: AssistantContextPayload | null): AssistantChip {
  if (ctx?.profileGaps.hasStrategyDoc) return expandStrategyChip(ctx);
  return {
    id: "open-strategy",
    label: "Create your strategy",
    variant: "action",
    tone: "violet",
    action: { type: "open_strategy" },
  };
}

function buildPersonalizedChatStarters(ctx: AssistantContextPayload): AssistantChip[] {
  const chips: AssistantChip[] = [];
  const target = strategyTargetRoles(ctx);

  if (ctx.profileGaps.hasStrategyDoc) {
    chips.push(expandStrategyChip(ctx));
    chips.push({
      id: "focus-week-personal",
      label: "What should I focus on this week?",
      variant: "chat",
      tone: "rose",
      action: {
        type: "chat",
        prompt: target
          ? `Given my strategy, pipeline, and profile — I'm targeting ${target}. What should I focus on this week?`
          : "Given everything you know about me — my strategy, pipeline, and profile — what should I focus on this week?",
      },
    });
  }

  if (ctx.profileGaps.hasPipelineJobs && ctx.pipelineSnippet !== "Pipeline is empty.") {
    const role = firstPipelineRole(ctx);
    chips.push({
      id: "pipeline-personal",
      label: role ? `What's my status on ${role}?` : "What's going on in my pipeline?",
      variant: "chat",
      tone: "mint",
      action: {
        type: "chat",
        prompt: role
          ? `Walk me through my pipeline — start with ${role}. What's strong, what's stale, and what am I missing?`
          : "Walk me through my pipeline — what's strong, what's stale, and what am I missing?",
      },
    });
  }

  const followUp = ctx.suggestions.find((s) => s.id === "follow-up");
  if (followUp) {
    chips.push(suggestionToChatChip(followUp, ctx));
  }

  const interview = ctx.suggestions.find((s) => s.id === "interview-prep");
  if (interview) {
    chips.push(suggestionToChatChip(interview, ctx));
  }

  return chips;
}

function buildPersonalizedFollowUpExtras(
  ctx: AssistantContextPayload,
  combined: string,
): AssistantChip[] {
  const out: AssistantChip[] = [];

  if (
    ctx.profileGaps.hasStrategyDoc &&
    /strategy|plan|priorit|focus|timeline|goal|week/i.test(combined)
  ) {
    out.push(expandStrategyChip(ctx));
  }

  if (ctx.profileGaps.hasPipelineJobs && /pipeline|application|role|job|apply|interview/i.test(combined)) {
    const interviewing = ctx.suggestions.find((s) => s.id === "interview-prep");
    if (interviewing) {
      out.push(suggestionToChatChip(interviewing, ctx));
    } else {
      const role = firstPipelineRole(ctx);
      if (role) {
        out.push({
          id: "pipeline-status",
          label: `Next step on ${role}`,
          variant: "chat",
          tone: "mint",
          action: {
            type: "chat",
            prompt: `Based on my pipeline, what's the best next move on ${role}?`,
          },
        });
      }
    }
  }

  if (ctx.inbox.pendingCount > 0) {
    const topEmail = ctx.inbox.activities.find((a) => !isPromotionalInboxActivity(a));
    if (topEmail) {
      const suggestion: AssistantSuggestion = {
        id: `inbox-${topEmail.id}`,
        kind: "inbox_email",
        title: topEmail.title ?? "Inbox update",
        detail: topEmail.snippet ?? "",
        meta: { activityId: topEmail.id },
        priority: 90,
      };
      const { label, prompt } = questionFromSuggestion(suggestion, ctx.inbox);
      out.push({
        id: suggestion.id,
        label,
        variant: "chat",
        tone: "amber",
        action: { type: "chat", prompt },
      });
    }
  }

  return out;
}

function shouldSkipChipForContext(chip: AssistantChip, ctx?: AssistantContextPayload | null): boolean {
  if (!ctx) return false;
  if (chip.action.type === "navigate" && chip.action.href === "/inbox" && ctx.inbox.pendingCount === 0) {
    return true;
  }
  if (chip.id === "strategy" && ctx.profileGaps.hasStrategyDoc) return true;
  if (chip.id === "create-strategy" && ctx.profileGaps.hasStrategyDoc) return true;
  if (chip.id === "resume" && ctx.profileGaps.hasResume) return true;
  if (chip.id === "upskill" && ctx.suggestions.some((s) => s.id.startsWith("apply-"))) return true;
  return false;
}

export function buildKnowsYouPreview(ctx: AssistantContextPayload | null): KnowsYouPreview | null {
  if (!ctx) return null;

  const hasPersonalData =
    ctx.profileGaps.hasStrategyDoc ||
    ctx.profileGaps.hasResume ||
    ctx.profileGaps.hasPipelineJobs ||
    !!ctx.knowsYouSnippet?.trim();

  if (!hasPersonalData && ctx.summary === "Getting started with Kimchi.") {
    return null;
  }

  const headline =
    ctx.summary !== "Getting started with Kimchi." ? ctx.summary : "I'm learning your search";
  const details: string[] = [];

  const target = strategyTargetRoles(ctx);
  if (ctx.profileGaps.hasStrategyDoc && target) {
    details.push(`Strategy: targeting ${target}`);
  } else if (ctx.profileGaps.hasStrategyDoc) {
    details.push("Career strategy doc on file");
  }

  if (ctx.profileGaps.hasPipelineJobs) {
    const firstLine = ctx.pipelineSnippet.split("\n")[0]?.replace(/^- /, "");
    if (firstLine) details.push(`Pipeline: ${firstLine}`);
  }

  const resumeLine = ctx.knowsYouSnippet
    ?.split("\n")
    .find((l) => l.includes("Master resume") || l.includes("Resume text"));
  if (resumeLine) {
    details.push(resumeLine.replace(/^Master resume on file: /, "Resume: "));
  }

  return { headline, details: details.slice(0, 2) };
}

const MAX_CHIP_LABEL = 42;

/** Short, verb-first labels for chips shown in the UI. */
export function compactChipLabel(label: string, max = MAX_CHIP_LABEL): string {
  const t = label.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > max * 0.55) return `${cut.slice(0, lastSpace).trim()}…`;
  return `${cut.trim()}…`;
}

function compactChip(chip: AssistantChip): AssistantChip {
  return { ...chip, label: compactChipLabel(chip.label) };
}

/** Big-bucket starters for new threads — stable, not personalized. */
export const BUCKET_WELCOME_CHIPS: AssistantChip[] = [
  {
    id: "bucket-interview",
    label: "Prep for an interview",
    variant: "action",
    tone: "violet",
    action: { type: "chat", prompt: "Help me prep for an upcoming interview." },
  },
  {
    id: "bucket-search",
    label: "Start my job search",
    variant: "action",
    tone: "mint",
    action: { type: "chat", prompt: "Help me get my job search started — what should I focus on first?" },
  },
  {
    id: "bucket-strategy",
    label: "Work on my strategy",
    variant: "action",
    tone: "violet",
    action: { type: "chat", prompt: "Help me figure out my job search strategy and what to prioritize." },
  },
  {
    id: "bucket-strengths",
    label: "Know what I'm good at",
    variant: "action",
    tone: "sky",
    action: { type: "chat", prompt: "Help me understand what I'm good at and how to talk about it." },
  },
  {
    id: "bucket-priority",
    label: "Know what to do next",
    variant: "action",
    tone: "rose",
    action: { type: "chat", prompt: "What should I focus on next in my job search?" },
  },
  {
    id: "bucket-learn",
    label: "Know what to learn",
    variant: "action",
    tone: "amber",
    action: { type: "chat", prompt: "What skills or gaps should I work on for the roles I'm targeting?" },
  },
  {
    id: "what-recommend",
    label: "What do you recommend?",
    variant: "action",
    tone: "neutral",
    action: { type: "show_recommendations" },
  },
];

/** Short starters when prepping for a coach session. */
export const COACH_PREP_STARTER_CHIPS: AssistantChip[] = [
  {
    id: "coach-ask-track",
    label: "Ask about their track record",
    variant: "chat",
    tone: "mint",
    action: { type: "chat", prompt: "What should I ask about their track record and results?" },
  },
  {
    id: "coach-open",
    label: "Open without wasting time",
    variant: "chat",
    tone: "sky",
    action: { type: "chat", prompt: "How should I open the call without wasting time?" },
  },
  {
    id: "coach-walkaway",
    label: "Know what to walk away with",
    variant: "chat",
    tone: "violet",
    action: { type: "chat", prompt: "What should I walk away with from this session?" },
  },
  {
    id: "coach-worth",
    label: "Decide if they're worth it",
    variant: "chat",
    tone: "rose",
    action: { type: "chat", prompt: "Is this coach worth my time given my goals?" },
  },
];

export function buildCoachPrepWelcomeMessage(
  coachName: string,
  matchScore?: number,
  matchLabel?: string,
): string {
  const matchNote =
    matchScore && matchScore > 0 ? ` You're a ${matchLabel ?? "match"} (${matchScore}/100) on paper.` : "";
  return `Let's prep for your session with ${coachName}.${matchNote} Pick a starter below or ask anything.`;
}

const GENERIC_CHAT_STARTERS: AssistantChip[] = [
  {
    id: "plan-search",
    label: "Plan my job search",
    variant: "chat",
    tone: "mint",
    action: {
      type: "chat",
      prompt: "Help me plan my job search for the next two weeks — what should I prioritize?",
    },
  },
  {
    id: "focus-week",
    label: "What should I focus on?",
    variant: "chat",
    tone: "rose",
    action: {
      type: "chat",
      prompt: "Given everything you know about me, what should I focus on this week?",
    },
  },
  {
    id: "pipeline-review",
    label: "Review my pipeline",
    variant: "chat",
    tone: "neutral",
    action: {
      type: "chat",
      prompt: "Walk me through my pipeline — what's strong, what's stale, and what am I missing?",
    },
  },
];

const DEFAULT_ACTIONS: AssistantChip[] = [
  {
    id: "strategy",
    label: "Build career strategy",
    hint: "Turn your goals into a strategy doc",
    variant: "action",
    tone: "violet",
    action: { type: "open_strategy" },
  },
  {
    id: "resume",
    label: "Work on my resume",
    hint: "Upload or edit your master resume",
    variant: "action",
    tone: "sky",
    action: { type: "navigate", href: "/profile/assets" },
  },
  {
    id: "upskill",
    label: "Add a skill to learn",
    hint: "Queue it on your Upskill path",
    variant: "action",
    tone: "amber",
    action: { type: "add_skill", skill: "SQL" },
  },
];

function suggestionToActionChip(s: AssistantSuggestion): AssistantChip | null {
  if (s.id === "create-strategy") {
    return {
      id: s.id,
      label: "Create your strategy",
      hint: s.detail,
      variant: "action",
      tone: "violet",
      action: { type: "open_strategy" },
    };
  }
  if (s.id === "upload-resume") {
    return {
      id: s.id,
      label: "Upload resume",
      hint: s.detail,
      variant: "action",
      tone: "sky",
      action: { type: "navigate", href: "/profile/assets" },
    };
  }
  if (s.id === "add-jobs") {
    return {
      id: s.id,
      label: "Add jobs to pipeline",
      hint: s.detail,
      variant: "action",
      action: { type: "navigate", href: "/opportunities/pipeline" },
    };
  }
  if (s.id === "connect-email") {
    return {
      id: s.id,
      label: "Connect your email",
      hint: s.detail,
      variant: "action",
      action: { type: "navigate", href: "/inbox" },
    };
  }
  if (s.kind === "inbox_email" && s.meta?.activityId) {
    return null;
  }
  if (s.id === "finish-readback") {
    return {
      id: s.id,
      label: "Finish profile summary",
      hint: s.detail,
      variant: "action",
      action: { type: "navigate", href: "/profile" },
    };
  }
  if (s.route && s.id !== "follow-up") {
    if (
      s.id.startsWith("apply-") ||
      s.id === "interview-prep" ||
      s.id === "current-job-fit" ||
      s.kind === "follow_up"
    ) {
      return null;
    }
    return {
      id: s.id,
      label: s.title,
      hint: s.detail,
      variant: "action",
      action: { type: "navigate", href: s.route },
    };
  }
  return null;
}

function suggestionToChatChip(s: AssistantSuggestion, ctx?: AssistantContextPayload | null): AssistantChip {
  const { label, prompt } = questionFromSuggestion(s, ctx?.inbox ?? null);
  return {
    id: `chat-${s.id}`,
    label,
    hint: s.detail,
    variant: "chat",
    action: { type: "chat", prompt },
  };
}

const WELCOME_PROFILE_ACTION_IDS = new Set([
  "create-strategy",
  "upload-resume",
  "add-jobs",
  "connect-email",
  "finish-readback",
]);

function welcomeToneForSuggestion(s: AssistantSuggestion): ChipTone {
  if (s.id === "interview-prep") return "violet";
  if (s.id === "follow-up" || s.kind === "follow_up") return "sky";
  if (s.id.startsWith("apply-")) return "amber";
  if (s.kind === "inbox_email") return "rose";
  if (s.id === "current-job-fit") return "mint";
  if (s.id === "create-strategy") return "violet";
  if (s.id === "upload-resume") return "sky";
  if (s.id === "connect-email") return "sky";
  if (s.id === "add-jobs") return "mint";
  return "mint";
}

/** Short colorful welcome chips for new threads — stable rule-based labels, no AI refresh. */
function suggestionToWelcomeChip(
  s: AssistantSuggestion,
  ctx: AssistantContextPayload | null,
): AssistantChip | null {
  if (WELCOME_PROFILE_ACTION_IDS.has(s.id)) {
    return suggestionToActionChip(s);
  }

  if (
    s.id === "interview-prep" ||
    s.id === "follow-up" ||
    s.id.startsWith("apply-") ||
    s.id === "current-job-fit" ||
    s.kind === "inbox_email" ||
    s.kind === "follow_up"
  ) {
    const { prompt } = questionFromSuggestion(s, ctx?.inbox ?? null);
    return {
      id: `welcome-${s.id}`,
      label: s.title,
      hint: s.detail,
      variant: "action",
      tone: welcomeToneForSuggestion(s),
      action: { type: "chat", prompt },
    };
  }

  return suggestionToActionChip(s);
}

export function buildWelcomeChips(_ctx: AssistantContextPayload | null): AssistantChip[] {
  return BUCKET_WELCOME_CHIPS.map(compactChip);
}

/** Profile-aware suggestion chips (same source as the old "Suggested" strip). */
export function buildContextSuggestionChips(ctx: AssistantContextPayload | null): AssistantChip[] {
  if (!ctx?.suggestions?.length) return [];

  const chips: AssistantChip[] = [];
  const seen = new Set<string>();
  const filtered = filterSuggestionsForWelcome(ctx.suggestions, ctx.inbox);

  for (const s of filtered) {
    const chip = suggestionToActionChip(s) ?? suggestionToChatChip(s, ctx);
    if (seen.has(chip.label)) continue;
    if (shouldSkipChipForContext(chip, ctx)) continue;
    seen.add(chip.label);
    chips.push(chip);
  }

  return chips.slice(0, 6);
}

export function buildStarterActions(ctx: AssistantContextPayload | null): AssistantChip[] {
  const fromContext = (ctx?.suggestions ?? [])
    .map(suggestionToActionChip)
    .filter((c): c is AssistantChip => !!c && !shouldSkipChipForContext(c, ctx));

  if (fromContext.length >= 3) return fromContext.slice(0, 4);

  const seen = new Set(fromContext.map((c) => c.id));
  const extras = DEFAULT_ACTIONS.filter((c) => {
    if (seen.has(c.id)) return false;
    if (shouldSkipChipForContext(c, ctx)) return false;
    if (c.id === "strategy" && seen.has("create-strategy")) return false;
    return true;
  });
  return [...fromContext, ...extras].slice(0, 4);
}

export function buildStarterChatChips(ctx: AssistantContextPayload | null): AssistantChip[] {
  if (!ctx?.suggestions?.length) {
    return GENERIC_CHAT_STARTERS.slice(0, 4);
  }

  const filtered = filterSuggestionsForWelcome(ctx.suggestions, ctx.inbox);
  const fromSuggestions = filtered
    .map((s) => suggestionToActionChip(s) ?? suggestionToChatChip(s, ctx))
    .filter((c) => !shouldSkipChipForContext(c, ctx));

  const personalized = buildPersonalizedChatStarters(ctx);
  const merged: AssistantChip[] = [];
  const seen = new Set<string>();

  for (const chip of [...fromSuggestions, ...personalized]) {
    if (seen.has(chip.label)) continue;
    seen.add(chip.label);
    merged.push(chip);
  }

  if (merged.length < 3) {
    for (const chip of GENERIC_CHAT_STARTERS) {
      if (seen.has(chip.label)) continue;
      seen.add(chip.label);
      merged.push(chip);
    }
  }

  return merged.slice(0, 5);
}

const TOPIC_RULES: Array<{ match: RegExp; chips: AssistantChip[] }> = [
  {
    match: /follow[- ]?up|reach out|haven't heard|check in|nudge/i,
    chips: [
      {
        id: "draft-followup",
        label: "Draft a follow-up",
        variant: "chat",
        action: { type: "chat", prompt: "Draft a short follow-up I can send." },
      },
      {
        id: "pipeline",
        label: "Open my pipeline",
        variant: "action",
        action: { type: "navigate", href: "/opportunities/pipeline" },
      },
    ],
  },
  {
    match: /interview|prep|screen|hiring manager|panel/i,
    chips: [
      {
        id: "prep-checklist",
        label: "Prep checklist",
        variant: "chat",
        action: { type: "chat", prompt: "Turn that into a short prep checklist I can use." },
      },
    ],
  },
  {
    match: /resume|bullet|position|frame|story|talk about/i,
    chips: [
      {
        id: "open-resume",
        label: "Open resume & assets",
        variant: "action",
        tone: "sky",
        action: { type: "navigate", href: "/profile/assets" },
      },
      {
        id: "resume-bullet",
        label: "Help me write a bullet",
        variant: "chat",
        action: { type: "chat", prompt: "Help me turn that into a strong resume bullet." },
      },
    ],
  },
  {
    match: /strategy|plan|priorit|focus|timeline|goal/i,
    chips: [
      {
        id: "open-strategy",
        label: "Create your strategy",
        variant: "action",
        tone: "violet",
        action: { type: "open_strategy" },
      },
      {
        id: "first-step",
        label: "What's my first step?",
        variant: "chat",
        action: { type: "chat", prompt: "What's the single best first step based on what you just said?" },
      },
    ],
  },
  {
    match: /skill|learn|upskill|gap|missing|course|certification/i,
    chips: [
      {
        id: "add-skill",
        label: "Add to Upskill path",
        variant: "action",
        action: { type: "add_skill", skill: "SQL" },
      },
      {
        id: "learning-path",
        label: "Open Upskill",
        variant: "action",
        action: { type: "navigate", href: "/profile/learning-path" },
      },
    ],
  },
  {
    match: /email|inbox|recruiter|reply/i,
    chips: [
      {
        id: "open-inbox",
        label: "Open inbox",
        variant: "action",
        action: { type: "navigate", href: "/inbox" },
      },
      {
        id: "reply-draft",
        label: "Draft a reply",
        variant: "chat",
        action: { type: "chat", prompt: "Draft a reply I can send." },
      },
    ],
  },
];

const FALLBACK_DRILLDOWNS: AssistantChip[] = [
  {
    id: "deeper",
    label: "Go deeper",
    variant: "chat",
    action: { type: "chat", prompt: "Go deeper on that — what am I missing?" },
  },
  {
    id: "example",
    label: "Give me an example",
    variant: "chat",
    action: { type: "chat", prompt: "Can you give me a concrete example?" },
  },
  {
    id: "next-step",
    label: "What's my next step?",
    variant: "chat",
    action: { type: "chat", prompt: "What's the single best next step for me?" },
  },
];

export function formatThreadForFollowUps(
  messages: Array<{ role: string; content: string }>,
  maxTurns = 10,
): string {
  return messages
    .slice(-maxTurns)
    .map((m) => {
      const speaker = m.role === "user" ? "User" : "Kimchi";
      return `${speaker}: ${m.content.trim().slice(0, 700)}`;
    })
    .join("\n\n");
}

export function formatThreadForCopy(
  messages: Array<{ kind?: string; role?: string; content?: string }>,
): string {
  return messages
    .filter((m) => (!m.kind || m.kind === "text") && m.content?.trim() && !isFailedAssistantReply(m.content))
    .map((m) => {
      const speaker = m.role === "user" ? "You" : "Kimchi";
      return `${speaker}: ${m.content!.trim()}`;
    })
    .join("\n\n");
}

const ALLOWED_NAV_ROUTES = [
  "/profile/assets",
  "/profile/career-strategy",
  "/profile/learning-path",
  "/profile",
  "/inbox",
  "/opportunities/pipeline",
];

function isAllowedNavigateHref(href: string): boolean {
  const path = href.split("?")[0] ?? href;
  if (ALLOWED_NAV_ROUTES.includes(path)) return true;
  if (path.startsWith("/opportunities/pipeline/")) return true;
  return false;
}

const VALID_TONES = new Set<ChipTone>(["violet", "sky", "amber", "mint", "rose", "neutral"]);

type AiFollowUpChip = {
  id?: string;
  label?: string;
  variant?: string;
  tone?: string;
  actionType?: string;
  href?: string;
  prompt?: string;
  skill?: string;
};

export function parseAiFollowUpChips(raw: unknown): AssistantChip[] {
  const chips = (raw as { chips?: AiFollowUpChip[] })?.chips;
  if (!Array.isArray(chips)) return [];

  const out: AssistantChip[] = [];
  for (let i = 0; i < chips.length; i++) {
    const c = chips[i];
    if (!c?.label?.trim()) continue;

    const label = c.label.trim().slice(0, 78);
    const id = (c.id || `ai-${i}`).slice(0, 64);
    const variant = c.variant === "action" ? "action" : "chat";
    const tone = VALID_TONES.has(c.tone as ChipTone)
      ? (c.tone as ChipTone)
      : variant === "action"
        ? "violet"
        : "neutral";

    let action: ChipAction | null = null;
    const actionType = c.actionType ?? (variant === "chat" ? "chat" : "navigate");

    switch (actionType) {
      case "navigate":
        if (c.href && isAllowedNavigateHref(c.href)) {
          action = { type: "navigate", href: c.href.split("?")[0] ?? c.href };
        }
        break;
      case "open_strategy":
        action = { type: "open_strategy" };
        break;
      case "generate_strategy":
        action = { type: "generate_strategy" };
        break;
      case "open_resume":
        action = { type: "navigate", href: "/profile/assets" };
        break;
      case "add_skill":
        action = { type: "add_skill", skill: (c.skill || "SQL").trim().slice(0, 40) };
        break;
      case "chat":
        if (c.prompt?.trim()) {
          action = { type: "chat", prompt: c.prompt.trim().slice(0, 400) };
        } else {
          action = { type: "chat", prompt: label };
        }
        break;
      default:
        break;
    }

    if (!action) continue;
    out.push({ id, label, variant, tone, action });
    if (out.length >= 5) break;
  }

  return out;
}

export function buildFollowUpChips(params: {
  userMessage: string;
  assistantMessage: string;
  threadContext?: string;
  profileGaps?: AssistantProfileGaps;
  ctx?: AssistantContextPayload | null;
}): AssistantChip[] {
  const ctx = params.ctx;
  const profileGaps = params.profileGaps ?? ctx?.profileGaps;
  const combined = [params.threadContext, params.userMessage, params.assistantMessage]
    .filter(Boolean)
    .join("\n");
  const out: AssistantChip[] = [];
  const usedLabels = new Set<string>();

  const pushChip = (chip: AssistantChip) => {
    const compact = compactChip(chip);
    if (usedLabels.has(compact.label)) return;
    if (shouldSkipChipForContext(compact, ctx)) return;
    usedLabels.add(compact.label);
    out.push(compact);
  };

  if (ctx?.suggestions?.length) {
    const filtered = filterSuggestionsForWelcome(ctx.suggestions, ctx.inbox);
    for (const s of filtered.slice(0, 4)) {
      const chip = suggestionToActionChip(s) ?? suggestionToChatChip(s, ctx);
      pushChip(chip);
      if (out.length >= 3) break;
    }
  }

  if (
    profileGaps &&
    !profileGaps.hasStrategyDoc &&
    /strategy|career plan|north star|goals doc|priorit|timeline|focus on/i.test(combined)
  ) {
    pushChip(openStrategyChip(ctx));
  } else if (profileGaps?.hasStrategyDoc && /strategy|plan|priorit|focus|timeline|goal/i.test(combined)) {
    pushChip(expandStrategyChip(ctx));
  }

  if (
    profileGaps &&
    !profileGaps.hasResume &&
    /resume|bullet|position|CV|curriculum/i.test(combined)
  ) {
    pushChip({
      id: "open-resume-gap",
      label: "Upload your resume",
      variant: "action",
      tone: "sky",
      action: { type: "navigate", href: "/profile/assets" },
    });
  }

  for (const rule of TOPIC_RULES) {
    if (!rule.match.test(combined)) continue;
    for (const chip of rule.chips) {
      if (chip.id === "open-strategy") {
        pushChip(openStrategyChip(ctx));
        continue;
      }
      if (shouldSkipChipForContext(chip, ctx)) continue;
      pushChip(chip);
      if (out.length >= 4) return out.slice(0, 4);
    }
  }

  if (ctx) {
    for (const chip of buildPersonalizedFollowUpExtras(ctx, combined)) {
      pushChip(chip);
      if (out.length >= 4) return out.slice(0, 4);
    }
  }

  for (const chip of FALLBACK_DRILLDOWNS) {
    pushChip(chip);
    if (out.length >= 4) break;
  }

  return out.slice(0, 4);
}

/** Back-compat for follow-ups API */
export function chipsToLegacy(chips: AssistantChip[]): ChatChip[] {
  return chips
    .filter((c) => c.action.type === "chat")
    .map((c) => ({
      id: c.id,
      label: c.label,
      prompt: c.action.type === "chat" ? c.action.prompt : c.label,
    }));
}

export function legacyToChips(chips: ChatChip[]): AssistantChip[] {
  return chips.map((c) => ({
    id: c.id,
    label: c.label,
    variant: "chat" as const,
    action: { type: "chat" as const, prompt: c.prompt },
  }));
}

export const WELCOME_MESSAGE =
  "Hey — what do you want to work on? Pick a topic below or ask anything.";

export function isFailedAssistantReply(text: string): boolean {
  return /couldn't generate|didn't get a reply|Something went wrong|hit a snag|isn't available in this environment|That didn't work|Couldn't reach Kimchi/i.test(
    text,
  );
}

export function isWelcomeOnlyThread(
  messages: Array<{ kind?: string; role?: string; content?: string }>,
  threadTitle?: string | null,
): boolean {
  const textMsgs = messages.filter((m) => !m.kind || m.kind === "text");
  const hasUserMessage = textMsgs.some((m) => m.role === "user");
  if (hasUserMessage) return false;

  if (threadTitle === "New chat" || threadTitle === NEW_THREAD_TITLE) return true;

  if (textMsgs.length === 0) return true;
  if (textMsgs.length === 1 && textMsgs[0].role === "assistant") {
    const c = textMsgs[0].content ?? "";
    return (
      c.includes("Talk it out") ||
      c.includes("pick an action") ||
      c.includes("pick something below") ||
      c.includes("what's on your mind") ||
      c.includes("Ask anything about your search") ||
      c.includes("Hey —") ||
      c.includes("Pick a starter below") ||
      c.includes("Let's prep for your session")
    );
  }
  return false;
}

/** @deprecated */
export function buildStarterChips(ctx: AssistantContextPayload | null): ChatChip[] {
  return chipsToLegacy([...buildStarterActions(ctx), ...buildStarterChatChips(ctx)]);
}

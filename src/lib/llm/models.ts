/** Kimchi model tiers — map tasks to gateway `provider/model` slugs. */
export type KimchiModelTier = "talk" | "analyze" | "create" | "parse";

/**
 * Vercel AI Gateway routing.
 *
 * **talk** — live chat, voice debrief, mail triage, follow-up chips (cheapest).
 * **analyze** — structured scoring / matching (Haiku-class).
 * **create** — long-form documents: strategy, resumes, cover letters (Sonnet).
 * **parse** — extraction / intake (Haiku-class).
 *
 * Chat model options (cheapest first, via AI Gateway):
 * - `openai/gpt-4o-mini` — recommended default; strong cost/quality for conversation
 * - `google/gemini-2.5-flash` — often cheaper; good for simple Q&A without tools
 * - `anthropic/claude-haiku-4.5` — better tool use (inbox/calendar chat); ~2× mini cost
 *
 * Set `KIMCHI_CHAT_GATEWAY_MODEL` to override the talk tier without a code change.
 */
export const KIMCHI_GATEWAY_MODELS: Record<KimchiModelTier, string> = {
  talk: process.env.KIMCHI_CHAT_GATEWAY_MODEL?.trim() || "openai/gpt-4o-mini",
  analyze: "anthropic/claude-haiku-4.5",
  create: "anthropic/claude-sonnet-4.6",
  parse: "anthropic/claude-haiku-4.5",
};

/** Direct Anthropic fallback when gateway auth is not configured (local dev only). */
export const KIMCHI_DIRECT_MODELS: Record<KimchiModelTier, string> = {
  talk: "claude-haiku-4-5-20251001",
  analyze: "claude-haiku-4-5-20251001",
  create: "claude-sonnet-4-6",
  parse: "claude-haiku-4-5-20251001",
};

/** @deprecated use kimchiModelId from @/lib/llm */
export const PARSE_MODEL = KIMCHI_DIRECT_MODELS.parse;

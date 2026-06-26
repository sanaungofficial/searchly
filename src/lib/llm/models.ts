/** Kimchi model tiers — map tasks to gateway `provider/model` slugs. */
export type KimchiModelTier = "talk" | "analyze" | "create" | "parse";

/** Vercel AI Gateway model IDs (provider/model, version dots not hyphens). */
export const KIMCHI_GATEWAY_MODELS: Record<KimchiModelTier, string> = {
  talk: "openai/gpt-4o-mini",
  analyze: "anthropic/claude-haiku-4.5",
  create: "anthropic/claude-sonnet-4.6",
  parse: "anthropic/claude-haiku-4.5",
};

/** Direct Anthropic fallback when gateway auth is not configured (local dev). */
export const KIMCHI_DIRECT_MODELS: Record<KimchiModelTier, string> = {
  talk: "claude-haiku-4-5-20251001",
  analyze: "claude-haiku-4-5-20251001",
  create: "claude-sonnet-4-6",
  parse: "claude-haiku-4-5-20251001",
};

/** @deprecated use kimchiModelId from @/lib/llm */
export const PARSE_MODEL = KIMCHI_DIRECT_MODELS.parse;

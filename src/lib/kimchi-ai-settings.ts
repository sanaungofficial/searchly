import { prisma } from "@/lib/prisma";
import { invalidatePromptCache } from "@/lib/prompts";
import { KIMCHI_GATEWAY_MODELS, type KimchiModelTier } from "@/lib/llm/models";

export type KimchiAiSettings = {
  /** Vercel AI Gateway model IDs (provider/model). */
  talkModel: string;
  analyzeModel: string;
  createModel: string;
  parseModel: string;
  /** When true, opening Kimchi chat may run inbox AI triage (costly). Default off. */
  autoInboxTriageOnOpen: boolean;
  /** When true, generate personalized "for you" chips on welcome using one AI call. */
  autoForYouOnOpen: boolean;
};

export const KIMCHI_AI_SETTINGS_KEY = "KIMCHI_AI_SETTINGS";

export const DEFAULT_KIMCHI_AI_SETTINGS: KimchiAiSettings = {
  talkModel: KIMCHI_GATEWAY_MODELS.talk,
  analyzeModel: KIMCHI_GATEWAY_MODELS.analyze,
  createModel: KIMCHI_GATEWAY_MODELS.create,
  parseModel: KIMCHI_GATEWAY_MODELS.parse,
  autoInboxTriageOnOpen: false,
  autoForYouOnOpen: false,
};

export const KIMCHI_AI_SETTINGS_SIDEBAR = {
  key: KIMCHI_AI_SETTINGS_KEY,
  label: "AI models & cost controls",
  description:
    "Gateway model routing per tier and toggles for automatic AI (inbox triage on chat open). Suggestions and next steps stay rule-based unless the user clicks an AI button.",
  category: "Kimchi Assistant",
} as const;

const SETTINGS_META = {
  label: KIMCHI_AI_SETTINGS_SIDEBAR.label,
  description: KIMCHI_AI_SETTINGS_SIDEBAR.description,
  category: KIMCHI_AI_SETTINGS_SIDEBAR.category,
};

const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._/-]*\/[a-z0-9][a-z0-9._-]*$/i;

function sanitizeModelId(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || !MODEL_ID_PATTERN.test(trimmed)) return fallback;
  return trimmed.slice(0, 80);
}

function parseSettings(content: string | undefined | null): KimchiAiSettings {
  if (!content) return { ...DEFAULT_KIMCHI_AI_SETTINGS };
  try {
    const parsed = JSON.parse(content) as Partial<KimchiAiSettings>;
    return {
      talkModel: sanitizeModelId(parsed.talkModel, DEFAULT_KIMCHI_AI_SETTINGS.talkModel),
      analyzeModel: sanitizeModelId(parsed.analyzeModel, DEFAULT_KIMCHI_AI_SETTINGS.analyzeModel),
      createModel: sanitizeModelId(parsed.createModel, DEFAULT_KIMCHI_AI_SETTINGS.createModel),
      parseModel: sanitizeModelId(parsed.parseModel, DEFAULT_KIMCHI_AI_SETTINGS.parseModel),
      autoInboxTriageOnOpen: parsed.autoInboxTriageOnOpen ?? DEFAULT_KIMCHI_AI_SETTINGS.autoInboxTriageOnOpen,
      autoForYouOnOpen: parsed.autoForYouOnOpen ?? DEFAULT_KIMCHI_AI_SETTINGS.autoForYouOnOpen,
    };
  } catch {
    return { ...DEFAULT_KIMCHI_AI_SETTINGS };
  }
}

let cached: { settings: KimchiAiSettings; at: number } | null = null;
const CACHE_MS = 60_000;

export function invalidateKimchiAiSettingsCache() {
  cached = null;
}

export async function getKimchiAiSettings(): Promise<KimchiAiSettings> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.settings;

  const row = await prisma.promptConfig.findUnique({ where: { key: KIMCHI_AI_SETTINGS_KEY } });
  const settings = parseSettings(row?.content);
  cached = { settings, at: Date.now() };
  return settings;
}

export function getKimchiModelIdFromSettings(settings: KimchiAiSettings, tier: KimchiModelTier): string {
  const envTalk = process.env.KIMCHI_CHAT_GATEWAY_MODEL?.trim();
  switch (tier) {
    case "talk":
      return envTalk || settings.talkModel;
    case "analyze":
      return settings.analyzeModel;
    case "create":
      return settings.createModel;
    case "parse":
      return settings.parseModel;
    default:
      return settings.talkModel;
  }
}

export async function getKimchiModelId(tier: KimchiModelTier): Promise<string> {
  const settings = await getKimchiAiSettings();
  return getKimchiModelIdFromSettings(settings, tier);
}

async function ensureSettingsRow() {
  const existing = await prisma.promptConfig.findUnique({ where: { key: KIMCHI_AI_SETTINGS_KEY } });
  if (existing) return existing;
  return prisma.promptConfig.create({
    data: {
      key: KIMCHI_AI_SETTINGS_KEY,
      label: SETTINGS_META.label,
      description: SETTINGS_META.description,
      category: SETTINGS_META.category,
      content: JSON.stringify(DEFAULT_KIMCHI_AI_SETTINGS, null, 2),
      defaultContent: JSON.stringify(DEFAULT_KIMCHI_AI_SETTINGS, null, 2),
    },
  });
}

export async function patchKimchiAiSettings(
  patch: Partial<KimchiAiSettings>,
  updatedBy?: string,
): Promise<KimchiAiSettings> {
  await ensureSettingsRow();
  const current = await getKimchiAiSettings();
  const next: KimchiAiSettings = {
    talkModel: sanitizeModelId(patch.talkModel, current.talkModel),
    analyzeModel: sanitizeModelId(patch.analyzeModel, current.analyzeModel),
    createModel: sanitizeModelId(patch.createModel, current.createModel),
    parseModel: sanitizeModelId(patch.parseModel, current.parseModel),
    autoInboxTriageOnOpen:
      typeof patch.autoInboxTriageOnOpen === "boolean"
        ? patch.autoInboxTriageOnOpen
        : current.autoInboxTriageOnOpen,
    autoForYouOnOpen:
      typeof patch.autoForYouOnOpen === "boolean" ? patch.autoForYouOnOpen : current.autoForYouOnOpen,
  };

  await prisma.promptConfig.update({
    where: { key: KIMCHI_AI_SETTINGS_KEY },
    data: {
      content: JSON.stringify(next, null, 2),
      updatedBy: updatedBy ?? undefined,
    },
  });

  invalidateKimchiAiSettingsCache();
  invalidatePromptCache();
  return next;
}

import { generateText, streamText, type ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  KIMCHI_DIRECT_MODELS,
  KIMCHI_GATEWAY_MODELS,
  type KimchiModelTier,
} from "@/lib/llm/models";

export function usesAiGateway(): boolean {
  return !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

/** True when gateway auth or legacy Anthropic key is available. */
export function isKimchiAiConfigured(): boolean {
  return usesAiGateway() || !!process.env.ANTHROPIC_API_KEY;
}

export function kimchiModelId(tier: KimchiModelTier): string {
  return usesAiGateway() ? KIMCHI_GATEWAY_MODELS[tier] : KIMCHI_DIRECT_MODELS[tier];
}

function resolveModel(tier: KimchiModelTier) {
  if (usesAiGateway()) {
    return KIMCHI_GATEWAY_MODELS[tier];
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic(KIMCHI_DIRECT_MODELS[tier]);
  }
  throw new Error("AI not configured");
}

function gatewayProviderOptions(userId?: string, tags?: string[]) {
  if (!usesAiGateway() || !userId) return undefined;
  return {
    gateway: {
      user: userId,
      ...(tags?.length ? { tags } : {}),
    },
  };
}

export async function kimchiGenerateText(params: {
  tier: KimchiModelTier;
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  maxOutputTokens?: number;
  userId?: string;
  tags?: string[];
}): Promise<{
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  modelId: string;
}> {
  const modelId = kimchiModelId(params.tier);
  const result = await generateText({
    model: resolveModel(params.tier),
    system: params.system,
    ...(params.messages
      ? { messages: params.messages }
      : { prompt: params.prompt ?? "" }),
    maxOutputTokens: params.maxOutputTokens ?? 1024,
    providerOptions: gatewayProviderOptions(params.userId, params.tags),
  });

  return {
    text: result.text,
    usage: {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    },
    modelId,
  };
}

export function kimchiStreamText(params: {
  tier: KimchiModelTier;
  system?: string;
  messages: ModelMessage[];
  maxOutputTokens?: number;
  userId?: string;
  tags?: string[];
  onUsage?: (usage: { inputTokens: number; outputTokens: number }, modelId: string) => void;
}): Response {
  const modelId = kimchiModelId(params.tier);
  const result = streamText({
    model: resolveModel(params.tier),
    system: params.system,
    messages: params.messages,
    maxOutputTokens: params.maxOutputTokens ?? 1024,
    providerOptions: gatewayProviderOptions(params.userId, params.tags),
    onFinish: ({ usage }) => {
      params.onUsage?.(
        {
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
        },
        modelId,
      );
    },
  });

  return result.toTextStreamResponse();
}

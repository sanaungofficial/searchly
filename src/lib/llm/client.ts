import { generateText, stepCountIs, streamText, type ModelMessage, type ToolSet } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getKimchiAiSettings, getKimchiModelIdFromSettings } from "@/lib/kimchi-ai-settings";
import {
  formatKimchiFollowUpsMarker,
  generateAiSuggestedFollowUps,
} from "@/lib/kimchi-assistant/chat-follow-ups";
import { KIMCHI_DIRECT_MODELS, type KimchiModelTier } from "@/lib/llm/models";

export function usesAiGateway(): boolean {
  return !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

/** True when Vercel AI Gateway or legacy Anthropic key is available. */
export function isKimchiAiConfigured(): boolean {
  return usesAiGateway() || !!process.env.ANTHROPIC_API_KEY;
}

export async function kimchiModelId(tier: KimchiModelTier): Promise<string> {
  const settings = await getKimchiAiSettings();
  return getKimchiModelIdFromSettings(settings, tier);
}

async function resolveModel(tier: KimchiModelTier) {
  const settings = await getKimchiAiSettings();
  const modelId = getKimchiModelIdFromSettings(settings, tier);
  if (usesAiGateway()) {
    return modelId;
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
  const modelId = await kimchiModelId(params.tier);
  const result = await generateText({
    model: await resolveModel(params.tier),
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

type KimchiStreamFollowUpContext = {
  userMessage: string;
  threadContext: string;
  userId: string;
};

async function appendFollowUpsToTextStream(
  result: Awaited<ReturnType<typeof streamText>>,
  base: Response,
  followUpContext?: KimchiStreamFollowUpContext,
): Promise<Response> {
  if (!followUpContext) return base;

  const body = base.body;
  if (!body) return base;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.textStream) {
          if (chunk) controller.enqueue(encoder.encode(chunk));
        }

        const finalText = ((await result.text) ?? "").trim();
        if (finalText.length >= 48) {
          const suggestedFollowUps = await generateAiSuggestedFollowUps({
            userMessage: followUpContext.userMessage,
            assistantMessage: finalText,
            threadContext: followUpContext.threadContext,
            userId: followUpContext.userId,
          });
          const marker = formatKimchiFollowUpsMarker(suggestedFollowUps);
          if (marker) controller.enqueue(encoder.encode(marker));
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            "Something went wrong on my end. Try your message again, or use the buttons below.",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: base.status,
    headers: base.headers,
  });
}

export async function kimchiStreamText(params: {
  tier: KimchiModelTier;
  system?: string;
  messages: ModelMessage[];
  maxOutputTokens?: number;
  userId?: string;
  tags?: string[];
  onUsage?: (usage: { inputTokens: number; outputTokens: number }, modelId: string) => void;
  followUpContext?: KimchiStreamFollowUpContext;
}): Promise<Response> {
  const modelId = await kimchiModelId(params.tier);
  const result = streamText({
    model: await resolveModel(params.tier),
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

  const base = result.toTextStreamResponse();
  if (!params.followUpContext) return base;
  return appendFollowUpsToTextStream(result, base, params.followUpContext);
}

export async function kimchiStreamTextWithTools(params: {
  tier: KimchiModelTier;
  system?: string;
  messages: ModelMessage[];
  tools: ToolSet;
  maxSteps?: number;
  maxOutputTokens?: number;
  userId?: string;
  tags?: string[];
  onUsage?: (usage: { inputTokens: number; outputTokens: number }, modelId: string) => void;
  followUpContext?: KimchiStreamFollowUpContext;
}): Promise<Response> {
  const modelId = await kimchiModelId(params.tier);
  const result = streamText({
    model: await resolveModel(params.tier),
    system: params.system,
    messages: params.messages,
    tools: params.tools,
    stopWhen: stepCountIs(params.maxSteps ?? 8),
    maxOutputTokens: params.maxOutputTokens ?? 1536,
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

  const base = result.toTextStreamResponse();
  const body = base.body;
  if (!body) return base;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let streamedAny = false;
      try {
        for await (const chunk of result.textStream) {
          if (!chunk) continue;
          streamedAny = true;
          controller.enqueue(encoder.encode(chunk));
        }

        const [finalText, steps] = await Promise.all([result.text, result.steps]);
        const trimmedFinal = (finalText ?? "").trim();

        if (!streamedAny && trimmedFinal) {
          controller.enqueue(encoder.encode(trimmedFinal));
          streamedAny = true;
        }

        if (!streamedAny) {
          let navigateReason: string | null = null;
          for (const step of steps) {
            for (const tr of step.toolResults ?? []) {
              if (tr.toolName === "open_app_page") {
                const payload = tr.output as { reason?: string | null } | undefined;
                navigateReason = payload?.reason ?? null;
              }
            }
          }
          controller.enqueue(
            encoder.encode(
              navigateReason?.trim() ||
                "I hit a snag generating a reply. Try sending that again — or tap a button below to keep going.",
            ),
          );
        }

        let navigateRoute: string | null = null;
        for (const step of steps) {
          for (const tr of step.toolResults ?? []) {
            if (tr.toolName !== "open_app_page") continue;
            const payload = tr.output as { navigateTo?: string } | undefined;
            if (payload?.navigateTo) navigateRoute = payload.navigateTo;
          }
        }
        if (navigateRoute) {
          controller.enqueue(encoder.encode(`\n<!--kimchi-nav:${navigateRoute}-->`));
        }

        if (params.followUpContext && trimmedFinal.length >= 48) {
          const suggestedFollowUps = await generateAiSuggestedFollowUps({
            userMessage: params.followUpContext.userMessage,
            assistantMessage: trimmedFinal,
            threadContext: params.followUpContext.threadContext,
            userId: params.followUpContext.userId,
          });
          const marker = formatKimchiFollowUpsMarker(suggestedFollowUps);
          if (marker) controller.enqueue(encoder.encode(marker));
        }
      } catch {
        controller.enqueue(
          encoder.encode(
            "Something went wrong on my end. Try your message again, or use the buttons below.",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: base.status,
    headers: base.headers,
  });
}

import { prisma } from "@/lib/prisma";

// Pricing in USD per million tokens (as of June 2026)
const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-sonnet-4-6": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "claude-haiku-4-5-20251001": { inputPerMTok: 0.80, outputPerMTok: 4.00 },
  "anthropic/claude-sonnet-4.6": { inputPerMTok: 3.00, outputPerMTok: 15.00 },
  "anthropic/claude-haiku-4.5": { inputPerMTok: 0.80, outputPerMTok: 4.00 },
  "openai/gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.60 },
};

export function calcCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { inputPerMTok: 3.00, outputPerMTok: 15.00 };
  return (inputTokens / 1_000_000) * pricing.inputPerMTok +
         (outputTokens / 1_000_000) * pricing.outputPerMTok;
}

export async function logAiUsage({
  userId,
  feature,
  model,
  inputTokens,
  outputTokens,
}: {
  userId: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const costUsd = calcCostUsd(model, inputTokens, outputTokens);
  await prisma.aiUsageLog.create({
    data: { userId, feature: feature as never, model, tokensIn: inputTokens, tokensOut: outputTokens, costUsd },
  });
}

export function formatCostUsd(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

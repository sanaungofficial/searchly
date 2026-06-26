import { prisma } from "@/lib/prisma";
import { AiFeature } from "@prisma/client";

export type { AiFeature };

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  "claude-sonnet-4-6": { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  "anthropic/claude-haiku-4.5": { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  "anthropic/claude-sonnet-4.6": { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  "openai/gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
};

export function calcCost(model: string, tokensIn: number, tokensOut: number): number {
  const price = PRICING[model] ?? { input: 0, output: 0 };
  return tokensIn * price.input + tokensOut * price.output;
}

export function logAiUsage(
  userId: string,
  feature: AiFeature,
  model: string,
  tokensIn: number,
  tokensOut: number,
): void {
  const costUsd = calcCost(model, tokensIn, tokensOut);
  prisma.aiUsageLog.create({
    data: { userId, feature, model, tokensIn, tokensOut, costUsd },
  }).catch(() => {});
}

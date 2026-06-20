import { prisma } from "@/lib/prisma";

// Pricing in USD per million tokens (as of June 2026)
const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-sonnet-4-6":          { inputPerMTok: 3.00,  outputPerMTok: 15.00 },
  "claude-haiku-4-5-20251001":  { inputPerMTok: 0.80,  outputPerMTok: 4.00  },
};

export function calcCostMicros(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { inputPerMTok: 3.00, outputPerMTok: 15.00 };
  const costUsd =
    (inputTokens  / 1_000_000) * pricing.inputPerMTok +
    (outputTokens / 1_000_000) * pricing.outputPerMTok;
  return Math.round(costUsd * 1_000_000); // store as microdollars (millionths)
}

export async function logAiUsage({
  userId,
  feature,
  model,
  inputTokens,
  outputTokens,
}: {
  userId: string;
  feature: "chat" | "readback" | "parse-job";
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const costUsdMicros = calcCostMicros(model, inputTokens, outputTokens);
  await prisma.aiUsageLog.create({
    data: { userId, feature, model, inputTokens, outputTokens, costUsdMicros },
  });
}

export function microsToDollars(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

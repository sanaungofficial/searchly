import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { kimchiGenerateText } from "@/lib/llm";
import {
  mergeOnelinerSuggestions,
  suggestFromOneliner,
  type OnelinerAnalysisResponse,
  type OnelinerSuggestions,
} from "@/lib/onboarding-oneliner-suggestions";
import type { WorkArrangementId } from "@/lib/onboarding-preferences";

export type OnelinerAnalysisResponse = {
  picture: string;
  strengths: string[];
  targetRoles: { role: string; match: string }[];
  prioritizedCategories: string[];
  deprioritizedCategories: string[];
  targetMarket: string | null;
  workArrangement: WorkArrangementId | null;
};

const SYSTEM = `You are a career advisor. Given a one-sentence professional description, return a JSON object that identifies the person's background and recommends roles to target.

Return ONLY valid JSON in this exact shape:
{
  "picture": "A 1-2 sentence professional summary of this person.",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "targetRoles": [
    { "role": "Senior Product Manager", "match": "One sentence on why this fits." }
  ],
  "prioritizedCategories": ["Product Jobs", "Operations Jobs"],
  "deprioritizedCategories": ["Sales Jobs"],
  "targetMarket": "San Francisco",
  "workArrangement": "remote_only"
}

Rules:
- picture: 1-2 sentences, professional, specific to what they described.
- strengths: exactly 3 items, concrete skills or attributes implied by their description.
- targetRoles: 5-8 roles with specific senior titles.
- prioritizedCategories: 1-4 Hirebase-style category labels ending in " Jobs" (e.g. "Product Jobs", "Engineering Jobs").
- deprioritizedCategories: 0-3 categories they likely want to avoid (same list). Only include when clearly implied.
- targetMarket: city/region if mentioned, else null.
- workArrangement: one of remote_only, hybrid_ok, onsite_ok, or null if unclear.
- No commentary outside the JSON.`;

type AiPayload = {
  picture?: unknown;
  strengths?: unknown[];
  targetRoles?: unknown[];
  prioritizedCategories?: unknown[];
  deprioritizedCategories?: unknown[];
  targetMarket?: unknown;
  workArrangement?: unknown;
};

function buildResponse(
  oneliner: string,
  suggestions: OnelinerSuggestions,
  picture: string,
  strengths: string[],
  targetRoles: { role: string; match: string }[],
): OnelinerAnalysisResponse {
  return {
    picture,
    strengths,
    targetRoles,
    prioritizedCategories: suggestions.prioritizedCategories,
    deprioritizedCategories: suggestions.deprioritizedCategories,
    targetMarket: suggestions.targetMarket,
    workArrangement: suggestions.workArrangement,
  };
}

function filterCategories(items: unknown[] | undefined): string[] {
  return (items ?? []).filter((c): c is string => typeof c === "string" && / Jobs$/i.test(c.trim()));
}

function parseWorkArrangement(value: unknown): WorkArrangementId | null {
  if (value === "remote_only" || value === "hybrid_ok" || value === "onsite_ok") return value;
  return null;
}

function heuristicFallback(oneliner: string): OnelinerAnalysisResponse {
  const heuristic = suggestFromOneliner(oneliner);
  return buildResponse(
    oneliner,
    heuristic,
    `Based on your description: ${oneliner}`,
    ["Cross-functional collaboration", "Strategic thinking", "Operational execution"],
    heuristic.targetRoles.map((role) => ({
      role,
      match: "Suggested from your one-liner.",
    })),
  );
}

export async function POST(req: NextRequest) {
  const { dbUser } = await getActingUser(req);
  if (!dbUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let oneliner: string;
  try {
    const body = await req.json();
    oneliner = typeof body.oneliner === "string" ? body.oneliner.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!oneliner) {
    return NextResponse.json({ error: "oneliner is required" }, { status: 400 });
  }

  const heuristic = suggestFromOneliner(oneliner);

  try {
    const { text } = await kimchiGenerateText({
      tier: "fast",
      system: SYSTEM,
      prompt: `Professional description: "${oneliner}"`,
      userId: dbUser.id,
      tags: ["onboarding-oneliner"],
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(heuristicFallback(oneliner));
    }

    const parsed = JSON.parse(jsonMatch[0]) as AiPayload;
    if (typeof parsed.picture !== "string" || !Array.isArray(parsed.strengths) || !Array.isArray(parsed.targetRoles)) {
      return NextResponse.json(heuristicFallback(oneliner));
    }

    const targetRoles = parsed.targetRoles
      .filter(
        (r): r is { role: string; match: string } =>
          typeof (r as Record<string, unknown>).role === "string",
      )
      .map((r) => ({
        role: r.role,
        match: typeof r.match === "string" ? r.match : "Suggested from your background.",
      }));

    const aiSuggestions: Partial<OnelinerSuggestions> = {
      targetRoles: targetRoles.map((r) => r.role),
      prioritizedCategories: filterCategories(parsed.prioritizedCategories),
      deprioritizedCategories: filterCategories(parsed.deprioritizedCategories),
      targetMarket: typeof parsed.targetMarket === "string" ? parsed.targetMarket.trim() || null : null,
      workArrangement: parseWorkArrangement(parsed.workArrangement),
    };

    const merged = mergeOnelinerSuggestions(aiSuggestions, heuristic);

    return NextResponse.json(
      buildResponse(
        oneliner,
        merged,
        parsed.picture,
        parsed.strengths.filter((s): s is string => typeof s === "string").slice(0, 5),
        targetRoles.length
          ? targetRoles
          : merged.targetRoles.map((role) => ({
              role,
              match: "Suggested from your one-liner.",
            })),
      ),
    );
  } catch {
    return NextResponse.json(heuristicFallback(oneliner));
  }
}

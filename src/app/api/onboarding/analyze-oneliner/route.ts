import { NextRequest, NextResponse } from "next/server";
import { getActingUser } from "@/lib/acting-user";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import {
  mergeOnelinerSuggestions,
  suggestFromOneliner,
  type OnelinerAnalysisResponse,
  type OnelinerSuggestions,
} from "@/lib/onboarding-oneliner-suggestions";
import type { WorkArrangementId } from "@/lib/onboarding-preferences";
import { FALLBACK_JOB_CATEGORIES } from "@/lib/hirebase-role-discovery";

export type { OnelinerAnalysisResponse };

const SYSTEM = `You are a career advisor. Given a one-sentence professional pitch, return JSON that powers onboarding suggestions.

Return ONLY valid JSON in this exact shape:
{
  "picture": "A 1-2 sentence professional summary of this person.",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "targetRoles": [
    { "role": "Senior Product Manager", "match": "One sentence on why this fits." }
  ],
  "prioritizedCategories": ["Product Jobs", "Operations Jobs"],
  "deprioritizedCategories": ["Sales Jobs"],
  "targetMarket": "Austin, TX",
  "workArrangement": "remote_only"
}

Rules:
- picture: 1-2 sentences, professional, specific to what they described.
- strengths: exactly 3 items, concrete skills or attributes implied by their description.
- targetRoles: 5-8 roles with specific senior titles.
- prioritizedCategories: 2-4 items from this list only: ${FALLBACK_JOB_CATEGORIES.join(", ")}
- deprioritizedCategories: 0-3 categories they likely want to avoid (same list). Only include when clearly implied.
- targetMarket: city/region if inferable, else null.
- workArrangement: one of remote_only, hybrid_ok, onsite_ok, or null if unclear.
- No commentary outside the JSON.`;

type AiPayload = {
  picture?: string;
  strengths?: unknown[];
  targetRoles?: unknown[];
  prioritizedCategories?: unknown[];
  deprioritizedCategories?: unknown[];
  targetMarket?: string | null;
  workArrangement?: string | null;
};

function asWorkArrangement(value: unknown): WorkArrangementId | null {
  if (value === "remote_only" || value === "hybrid_ok" || value === "onsite_ok") return value;
  return null;
}

function filterCategories(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const allowed = new Set(FALLBACK_JOB_CATEGORIES.map((c) => c.toLowerCase()));
  return values
    .filter((v): v is string => typeof v === "string")
    .filter((v) => allowed.has(v.trim().toLowerCase()))
    .slice(0, 5);
}

function buildResponse(
  oneliner: string,
  merged: OnelinerSuggestions,
  picture: string,
  strengths: string[],
  targetRoles: { role: string; match: string }[],
  source: OnelinerAnalysisResponse["source"],
): OnelinerAnalysisResponse {
  return {
    picture,
    strengths,
    targetRoles,
    prioritizedCategories: merged.prioritizedCategories,
    deprioritizedCategories: merged.deprioritizedCategories,
    targetMarket: merged.targetMarket,
    workArrangement: merged.workArrangement,
    source,
  };
}

function heuristicResponse(oneliner: string): OnelinerAnalysisResponse {
  const heuristic = suggestFromOneliner(oneliner);
  return buildResponse(
    oneliner,
    heuristic,
    `Based on your pitch: ${oneliner}`,
    ["Cross-functional collaboration", "Strategic thinking", "Operational execution"],
    heuristic.targetRoles.slice(0, 6).map((role) => ({
      role,
      match: "Suggested from your one-liner.",
    })),
    "heuristic",
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

  if (!isKimchiAiConfigured()) {
    return NextResponse.json(heuristicResponse(oneliner));
  }

  const heuristic = suggestFromOneliner(oneliner);

  try {
    const { text } = await kimchiGenerateText({
      tier: "fast",
      system: SYSTEM,
      prompt: `Professional pitch: "${oneliner}"`,
      userId: dbUser.id,
      tags: ["onboarding-oneliner"],
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(heuristicResponse(oneliner));
    }

    const parsed = JSON.parse(jsonMatch[0]) as AiPayload;
    if (
      typeof parsed.picture !== "string" ||
      !Array.isArray(parsed.strengths) ||
      !Array.isArray(parsed.targetRoles)
    ) {
      return NextResponse.json(heuristicResponse(oneliner));
    }

    const targetRoles = parsed.targetRoles
      .filter(
        (r): r is { role: string; match?: string } =>
          typeof (r as Record<string, unknown>).role === "string",
      )
      .map((r) => ({
        role: r.role,
        match: typeof r.match === "string" ? r.match : "Suggested from your one-liner.",
      }));

    const merged = mergeOnelinerSuggestions(
      {
        targetRoles: targetRoles.map((r) => r.role),
        prioritizedCategories: filterCategories(parsed.prioritizedCategories),
        deprioritizedCategories: filterCategories(parsed.deprioritizedCategories),
        targetMarket: typeof parsed.targetMarket === "string" ? parsed.targetMarket.trim() || null : null,
        workArrangement: asWorkArrangement(parsed.workArrangement),
      },
      heuristic,
    );

    return NextResponse.json(
      buildResponse(
        oneliner,
        merged,
        parsed.picture.trim(),
        parsed.strengths.filter((s): s is string => typeof s === "string").slice(0, 5),
        targetRoles.length
          ? targetRoles
          : merged.targetRoles.map((role) => ({
              role,
              match: "Suggested from your one-liner.",
            })),
        "ai",
      ),
    );
  } catch {
    return NextResponse.json(heuristicResponse(oneliner));
  }
}

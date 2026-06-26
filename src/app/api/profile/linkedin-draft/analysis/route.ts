import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import {
  linkedInDraftCompleteness,
  normalizeLinkedInAnalysis,
  parseLinkedInAnalysisFromModel,
} from "@/lib/linkedin-analysis";
import { normalizeLinkedInDraft } from "@/lib/linkedin-profile";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { profile: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const draft = normalizeLinkedInDraft(dbUser.profile?.linkedInDraft ?? null);
  if (!draft) {
    return NextResponse.json({ error: "No LinkedIn draft to analyze" }, { status: 404 });
  }

  const cached = normalizeLinkedInAnalysis(dbUser.profile?.linkedInDraftAnalysis ?? null);
  const cachedAt = dbUser.profile?.linkedInDraftAnalysisUpdatedAt;

  if (!force && cached && cachedAt) {
    return NextResponse.json({
      ...cached,
      _cachedAt: cachedAt.toISOString(),
    });
  }

  if (!isKimchiAiConfigured()) {
    const completeness = linkedInDraftCompleteness(draft);
    return NextResponse.json({
      score: completeness.pct,
      headline: "Heuristic score on dev — full AI analysis available on production.",
      strengths: [],
      improvements: completeness.missing.map((m, i) => ({
        priority: i === 0 ? "Urgent" : "Optional",
        title: m,
        detail: m,
      })),
      highlights: [],
      stale: true,
      _cachedAt: new Date().toISOString(),
    });
  }

  const template = await getPrompt("LINKEDIN_DRAFT_ANALYSIS");
  const prompt = interpolate(template, {
    draftJson: JSON.stringify(draft).slice(0, 12000),
  });

  const { text } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 2200,
    userId: dbUser.id,
    tags: ["feature:linkedin-draft-analysis"],
  });

  const parsed = parseLinkedInAnalysisFromModel(text);
  if (!parsed) {
    return NextResponse.json({ error: "Failed to parse analysis" }, { status: 500 });
  }

  const now = new Date();
  await prisma.profile.updateMany({
    where: { userId: dbUser.id },
    data: {
      linkedInDraftAnalysis: parsed as object,
      linkedInDraftAnalysisUpdatedAt: now,
    },
  });

  return NextResponse.json({ ...parsed, _cachedAt: now.toISOString() });
}

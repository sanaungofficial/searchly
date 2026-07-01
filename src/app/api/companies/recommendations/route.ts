import { createClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureDbUser } from "@/lib/ensure-db-user";
import { requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { isKimchiAiConfigured, kimchiGenerateText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";
import { normalizeCompanySlug } from "@/lib/company-catalog";
import {
  buildRecommendationFingerprint,
  buildRecommendationSignals,
  computeCompanyRecommendations,
  mergeAiBlurbs,
  recommendationsForAiBlurbs,
  type CompanyRecommendationsCache,
  type CompanyRecommendation,
} from "@/lib/company-recommendations";
import { NextResponse } from "next/server";

function watchlistSlugsFromCompanies(
  companies: { name: string; companyIntel?: { slug?: string | null } | null }[],
): string[] {
  const slugs = new Set<string>();
  for (const row of companies) {
    const intelSlug = row.companyIntel?.slug?.trim();
    if (intelSlug) slugs.add(intelSlug);
    slugs.add(normalizeCompanySlug(row.name));
  }
  return [...slugs];
}

function profileSummaryFromSignals(signals: ReturnType<typeof buildRecommendationSignals>): string {
  const parts: string[] = [];
  if (signals.targetRoles.length) parts.push(`Target roles: ${signals.targetRoles.join(", ")}`);
  const topRole = signals.targetRoles[0];
  if (topRole && signals.targetRoles.length > 1) parts.push(`Top target role: ${topRole}`);
  const skills = [...(signals.parsedData?.skills ?? []), ...(signals.parsedData?.tools ?? [])];
  if (skills.length) parts.push(`Skills/tools: ${skills.slice(0, 20).join(", ")}`);
  const latest = signals.parsedData?.workExperience?.[0];
  if (latest) parts.push(`Latest role: ${latest.title} at ${latest.company}`);
  if (signals.readbackData?.picture) parts.push(`Profile readback: ${signals.readbackData.picture.slice(0, 400)}`);
  return parts.join("\n") || "Limited profile data — infer from company list only.";
}

async function enrichWithAiBlurbs(
  userId: string,
  recommendations: CompanyRecommendation[],
  signals: ReturnType<typeof buildRecommendationSignals>,
): Promise<CompanyRecommendation[]> {
  if (!isKimchiAiConfigured()) return recommendations;

  const top = recommendationsForAiBlurbs(recommendations);
  if (!top.length) return recommendations;

  const companiesJson = JSON.stringify(
    top.map((c) => ({
      catalogSlug: c.catalogSlug,
      name: c.name,
      type: c.type,
      heuristicReasons: c.reasons,
    })),
  );

  const skills = [...(signals.parsedData?.skills ?? []), ...(signals.parsedData?.tools ?? [])].join(", ");
  const template = await getPrompt("COMPANY_RECOMMENDATIONS");
  const prompt = interpolate(template, {
    targetRoles: signals.targetRoles.join(", ") || "Not specified",
    skills: skills || "None listed",
    tools: (signals.parsedData?.tools ?? []).join(", ") || "None listed",
    companiesJson,
    profileSummary: profileSummaryFromSignals(signals),
  });

  const { text, usage, modelId } = await kimchiGenerateText({
    tier: "analyze",
    prompt,
    maxOutputTokens: 700,
    userId,
    tags: ["feature:company-recommendations"],
  });

  logAiUsage({
    userId,
    feature: "company_recommendations",
    model: modelId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  }).catch(() => {});

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return recommendations;
    const blurbs = JSON.parse(jsonMatch[0]) as Record<string, string>;
    return mergeAiBlurbs(recommendations, blurbs);
  } catch {
    return recommendations;
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const dbUser = await ensureDbUser(supabase, request);
  if (!dbUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";
  const withAi = searchParams.get("ai") === "true";

  try {
    const [profile, trackedCompanies, userWithSub] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: dbUser.id } }),
      prisma.trackedCompany.findMany({
        where: { userId: dbUser.id },
        select: {
          name: true,
          companyIntel: { select: { slug: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: dbUser.id },
        include: { subscription: true },
      }),
    ]);

    const watchlistSlugs = watchlistSlugsFromCompanies(trackedCompanies);
    const signals = buildRecommendationSignals({
      targetRoles: profile?.targetRoles,
      prioritizedRoles: profile?.prioritizedRoles,
      parsedData: profile?.parsedData,
      readbackData: profile?.readbackData,
      watchlistSlugs,
    });
    const fingerprint = buildRecommendationFingerprint(signals);

    const cached = profile?.companyRecommendationsCache as CompanyRecommendationsCache | null;
    const cachedAt = profile?.companyRecommendationsUpdatedAt;

    if (!force && cached?.recommendations?.length && cached.fingerprint === fingerprint && cachedAt) {
      return NextResponse.json({
        recommendations: cached.recommendations,
        aiEnriched: cached.aiEnriched ?? false,
        _cachedAt: cachedAt.toISOString(),
      });
    }

    let recommendations = computeCompanyRecommendations(signals);
    let aiEnriched = false;

    if (withAi && recommendations.length > 0) {
      if (!isKimchiAiConfigured()) {
        return NextResponse.json({ error: "AI not configured" }, { status: 503 });
      }
      const quotaError = await requireAiQuota(userWithSub!, "SCOUT");
      if (quotaError) return quotaError;
      recommendations = await enrichWithAiBlurbs(dbUser.id, recommendations, signals);
      aiEnriched = true;
    }

    if (profile) {
      const cachePayload: CompanyRecommendationsCache = {
        fingerprint,
        recommendations,
        aiEnriched,
      };
      const now = new Date();
      await prisma.profile
        .update({
          where: { id: profile.id },
          data: {
            companyRecommendationsCache: cachePayload,
            companyRecommendationsUpdatedAt: now,
          },
        })
        .catch((err) => console.warn("[company-recommendations] cache persist failed:", err));

      return NextResponse.json({
        recommendations,
        aiEnriched,
        _cachedAt: now.toISOString(),
      });
    }

    return NextResponse.json({ recommendations, aiEnriched });
  } catch (err) {
    console.error("[companies/recommendations GET]", err);
    return NextResponse.json({ error: "Couldn't load recommendations." }, { status: 500 });
  }
}

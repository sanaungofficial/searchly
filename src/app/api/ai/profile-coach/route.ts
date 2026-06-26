import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { buildStrategyPromptContext } from "@/lib/career-strategy-context";
import { normalizeStrategyDocument } from "@/lib/career-strategy";
import { isKimchiAiConfigured, kimchiStreamText } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { getPrompt, interpolate } from "@/lib/prompts";

export async function POST(request: Request) {
  if (!isKimchiAiConfigured()) {
    return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503 });
  }

  const auth = await getAuthedUserForAi(request);
  if ("error" in auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: auth.error.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { dbUser } = auth;

  const quotaError = await requireAiQuota(dbUser, "SCOUT");
  if (quotaError) {
    const body = await quotaError.json();
    return new Response(JSON.stringify(body), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { messages } = body as { messages: { role: "user" | "assistant"; content: string }[] };

  const profile = dbUser.profile;
  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404 });
  }
  const trackedCompanies = await prisma.trackedCompany.findMany({
    where: { userId: dbUser.id },
    take: 20,
  });

  const ctx = buildStrategyPromptContext({
    user: dbUser,
    profile: profile!,
    trackedCompanies,
    intakeNotes: profile?.strategyIntakeNotes,
  });

  const profileContext = [
    `Target roles: ${ctx.targetRoles}`,
    `Target salary: ${ctx.targetSalary} | Timeline: ${ctx.jobTimeline}`,
    `Target market: ${ctx.targetMarket} | Location: ${ctx.currentLocation}`,
    `Relocation: ${ctx.relocationOpenness} | Clearance: ${ctx.securityClearance}`,
    `Search duration: ${ctx.searchDuration}`,
    `Motivation: ${ctx.careerMotivation}`,
    `Priorities: ${ctx.priorities}`,
    `Readback: ${ctx.readbackPicture}`,
  ].join("\n");

  const strategyDoc = profile?.strategyData
    ? normalizeStrategyDocument(profile.strategyData)
    : null;
  const strategySummary = strategyDoc?.executiveSummary
    ? strategyDoc.executiveSummary.slice(0, 500)
    : "No strategy document generated yet.";

  const template = await getPrompt("PROFILE_COACH_SYSTEM");
  const systemPrompt = interpolate(template, {
    candidateName: ctx.candidateName,
    profileContext,
    intakeNotes: ctx.intakeNotes,
    strategySummary,
  });

  return kimchiStreamText({
    tier: "talk",
    system: systemPrompt,
    messages,
    maxOutputTokens: 1500,
    userId: dbUser.id,
    tags: ["feature:profile-coach"],
    onUsage: (usage, modelId) => {
      logAiUsage({
        userId: dbUser.id,
        feature: "profile_coach",
        model: modelId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      }).catch(() => {});
    },
  });
}

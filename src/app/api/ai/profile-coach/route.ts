import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-cost";
import { buildStrategyPromptContext } from "@/lib/career-strategy-context";
import { normalizeStrategyDocument } from "@/lib/career-strategy";
import { prisma } from "@/lib/prisma";
import { getPrompt, interpolate } from "@/lib/prompts";
import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "AI not configured" }), { status: 503 });
  }

  const auth = await getAuthedUserForAi();
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

  const COACH_MODEL = "claude-sonnet-4-6";
  const stream = await getAnthropic().messages.stream({
    model: COACH_MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages,
  });

  stream.on("finalMessage", (msg) => {
    logAiUsage({
      userId: dbUser.id,
      feature: "profile_coach",
      model: COACH_MODEL,
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    }).catch(() => {});
  });

  return new Response(stream.toReadableStream(), {
    headers: { "Content-Type": "text/event-stream" },
  });
}

import { getAuthedUserForAi, requireAiQuota } from "@/lib/ai-guard";
import { logAiUsage } from "@/lib/ai-usage";
import { isKimchiAiConfigured, kimchiStreamText } from "@/lib/llm";
import { getPrompt, interpolate } from "@/lib/prompts";

type CoachPrepBody = {
  messages: { role: "user" | "assistant"; content: string }[];
  coach: {
    displayName: string;
    headline?: string | null;
    category?: string | null;
    specialties?: string[];
    firms?: string[];
    schools?: string[];
    aboutMe?: string | null;
    bio?: string | null;
    whyCoach?: string | null;
    matchScore?: number;
    matchLabel?: string;
    matchReasons?: string[];
  };
};

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

  const body = (await request.json()) as CoachPrepBody;
  const { messages, coach } = body;

  if (!coach?.displayName?.trim()) {
    return new Response(JSON.stringify({ error: "Coach context is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const profile = dbUser.profile;
  const resumeText = profile?.resumeText || "";
  const targetRoles = (profile?.targetRoles ?? []).join(", ") || "Not specified";
  const priorities = (profile?.priorities ?? []).join(", ") || "Not specified";
  const careerMotivation = profile?.careerMotivation?.trim() || "Not specified";
  const candidateName = dbUser.name?.trim() || "Candidate";

  try {
  const coachContext = [
    `Name: ${coach.displayName}`,
    coach.headline ? `Headline: ${coach.headline}` : null,
    coach.category ? `Category: ${coach.category}` : null,
    coach.specialties?.length ? `Specialties: ${coach.specialties.join(", ")}` : null,
    coach.firms?.length ? `Firms: ${coach.firms.join(", ")}` : null,
    coach.schools?.length ? `Schools: ${coach.schools.join(", ")}` : null,
    coach.aboutMe ? `About: ${coach.aboutMe.slice(0, 1200)}` : null,
    coach.bio ? `Bio: ${coach.bio.slice(0, 800)}` : null,
    coach.whyCoach ? `Why they coach: ${coach.whyCoach.slice(0, 600)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const matchSummary =
    coach.matchScore && coach.matchScore > 0
      ? `${coach.matchLabel ?? "Match"} (${coach.matchScore}/100). ${(coach.matchReasons ?? []).slice(0, 3).join(" ")}`
      : "No profile match score — coach may still be relevant for adjacent goals.";

  const template = await getPrompt("COACH_PREP_SYSTEM");
  const systemPrompt = interpolate(template, {
    candidateName,
    resumeSlice: resumeText.slice(0, 6000),
    targetRoles,
    priorities,
    careerMotivation,
    coachContext,
    matchSummary,
  });

  return kimchiStreamText({
    tier: "talk",
    system: systemPrompt,
    messages,
    maxOutputTokens: 1024,
    userId: dbUser.id,
    tags: ["feature:coach-prep"],
    onUsage: (usage, modelId) => {
      logAiUsage(dbUser.id, "CHAT", modelId, usage.inputTokens, usage.outputTokens);
    },
  });
  } catch (err) {
    console.error("[coach-prep]", err);
    const message = err instanceof Error ? err.message : "Coach prep failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

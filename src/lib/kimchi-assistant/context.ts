import type { Profile, User } from "@prisma/client";
import { hasUnlimitedAiAccess } from "@/lib/ai-guard";
import { buildStrategyPromptContext } from "@/lib/career-strategy-context";
import { buildAssistantSuggestions } from "@/lib/kimchi-assistant/suggestions";
import { jobStageLabel } from "@/lib/kimchi-assistant/stages";
import type {
  AssistantContextPayload,
  AssistantPageHint,
  AssistantRoleMode,
} from "@/lib/kimchi-assistant/types";
import { getFeatureCreditStatus } from "@/lib/feature-credits";
import { prisma } from "@/lib/prisma";

type BuildContextInput = {
  user: User & { profile: Profile | null; subscription: { status: string; stripeCurrentPeriodEnd: Date } | null };
  pageHint?: AssistantPageHint;
};

function resolveRoleMode(user: User): AssistantRoleMode {
  if (user.role === "ADMIN") return "admin";
  if (user.role === "COACH") return "coach";
  return "seeker";
}

function formatPageHint(hint?: AssistantPageHint): string {
  if (!hint?.pathname && !hint?.jobRole) return "No specific page context.";
  const parts: string[] = [];
  if (hint.pathname) parts.push(`Current page: ${hint.pathname}`);
  if (hint.jobRole) {
    parts.push(
      `Focused job: ${hint.jobRole}${hint.jobCompany ? ` at ${hint.jobCompany}` : ""}${hint.jobDbId ? ` (id ${hint.jobDbId})` : ""}`,
    );
  }
  if (hint.chatView) parts.push(`Assistant panel mode: ${hint.chatView}`);
  return parts.join(". ");
}

export async function buildAssistantContext(input: BuildContextInput): Promise<AssistantContextPayload> {
  const { user, pageHint } = input;
  const profile = user.profile;
  const roleMode = resolveRoleMode(user);

  const [jobs, trackedCompanies, unlimited] = await Promise.all([
    prisma.job.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true,
        company: true,
        role: true,
        stage: true,
        updatedAt: true,
        appliedAt: true,
        fitAnalysis: true,
      },
    }),
    prisma.trackedCompany.findMany({
      where: { userId: user.id },
      take: 15,
      orderBy: { createdAt: "desc" },
    }),
    hasUnlimitedAiAccess(user),
  ]);

  const scoutCredits = await getFeatureCreditStatus(user.id, "SCOUT", unlimited);

  const strategy = profile
    ? buildStrategyPromptContext({
        user,
        profile,
        trackedCompanies,
        intakeNotes: profile.strategyIntakeNotes,
      })
    : null;

  const pipelineSnippet =
    jobs.length === 0
      ? "Pipeline is empty."
      : jobs
          .slice(0, 20)
          .map((j) => `- ${j.role} at ${j.company} (${jobStageLabel(j.stage)})`)
          .join("\n");

  const strategySnippet = strategy
    ? [
        `Target roles: ${strategy.targetRoles}`,
        `Timeline: ${strategy.jobTimeline} | Motivation: ${strategy.careerMotivation}`,
        `Priorities: ${strategy.priorities}`,
        strategy.readbackPicture ? `Readback: ${strategy.readbackPicture.slice(0, 400)}` : "",
        strategy.experienceSummary ? `Experience: ${strategy.experienceSummary}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Profile strategy not set up yet.";

  const creditsHint = unlimited
    ? "Credits: unlimited (Pro/admin)."
    : scoutCredits.remaining === null
      ? "Credits: check plan."
      : `Scout credits remaining today: ${scoutCredits.remaining} of ${scoutCredits.dailyLimit ?? "?"}.`;

  const suggestions = buildAssistantSuggestions(jobs, profile, pageHint);

  const summaryParts = [
    `${jobs.length} job${jobs.length === 1 ? "" : "s"} in pipeline`,
    profile?.targetRoles?.length ? `targeting ${profile.targetRoles.slice(0, 3).join(", ")}` : null,
    suggestions[0]?.title ? `top suggestion: ${suggestions[0].title}` : null,
  ].filter(Boolean);

  return {
    roleMode,
    summary: summaryParts.join("; ") || "Getting started with Kimchi.",
    strategySnippet,
    pipelineSnippet,
    pageHint: formatPageHint(pageHint),
    creditsHint,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
}

export function formatAssistantContextForPrompt(ctx: AssistantContextPayload): string {
  const roleLine =
    ctx.roleMode === "coach"
      ? "User is a coach using Kimchi — help with client prep and profile shaping when relevant."
      : ctx.roleMode === "admin"
        ? "User is an admin — stay helpful; do not expose internal system details."
        : "User is a job seeker.";

  const suggestionBlock =
    ctx.suggestions.length > 0
      ? `\nProactive suggestions (mention naturally when relevant):\n${ctx.suggestions
          .map((s) => `- ${s.title}: ${s.detail}${s.route ? ` → ${s.route}` : ""}`)
          .join("\n")}`
      : "";

  return `${roleLine}

Search context:
${ctx.strategySnippet}

Pipeline:
${ctx.pipelineSnippet}

${ctx.pageHint}
${ctx.creditsHint}
${suggestionBlock}

You can call open_ui_route to send them to a screen when the UI is the best next step. You can call suggest_next_actions to refresh suggestions. v1 is read-only — you cannot change their data yet; say what you'd update and they'll do it in the app.`;
}

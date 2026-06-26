import type { Profile, User } from "@prisma/client";
import { hasUnlimitedAiAccess } from "@/lib/ai-guard";
import { buildStrategyPromptContext } from "@/lib/career-strategy-context";
import { getAssignedCoachesForUser } from "@/lib/coach-client-assignment";
import { assetTypeLabel } from "@/lib/asset-types";
import { buildAssistantSuggestions } from "@/lib/kimchi-assistant/suggestions";
import {
  inboxSuggestionsFromSnapshot,
  loadInboxSnapshot,
} from "@/lib/kimchi-assistant/inbox-suggestions";
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

function parseFitScore(fitAnalysis: string | null): number | null {
  if (!fitAnalysis) return null;
  try {
    const parsed = JSON.parse(fitAnalysis) as { score?: number };
    if (typeof parsed.score === "number") return Math.min(100, Math.round(parsed.score * 10));
  } catch {
    /* ignore */
  }
  return null;
}

function readbackPicture(profile: Profile | null): string | null {
  if (!profile?.readbackData) return null;
  try {
    const data = profile.readbackData as { picture?: string };
    return typeof data.picture === "string" ? data.picture : null;
  } catch {
    return null;
  }
}

export async function buildAssistantContext(input: BuildContextInput): Promise<AssistantContextPayload> {
  const { user, pageHint } = input;
  const profile = user.profile;
  const roleMode = resolveRoleMode(user);

  const [jobs, trackedCompanies, unlimited, primaryResume, assignedCoaches, coachDocs, coachSessionNotes] =
    await Promise.all([
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
      prisma.userAsset.findFirst({
        where: { userId: user.id, type: "RESUME", isPrimary: true },
        select: { id: true, name: true, updatedAt: true },
      }),
      getAssignedCoachesForUser(user.id),
      prisma.coachSharedDocument.findMany({
        where: { clientUserId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { coachProfile: { select: { displayName: true } } },
      }),
      prisma.coachClientSessionNote.findMany({
        where: { clientUserId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 4,
        include: { coachProfile: { select: { displayName: true } } },
      }),
    ]);

  const scoutCredits = await getFeatureCreditStatus(user.id, "SCOUT", unlimited);

  const inbox = await loadInboxSnapshot(user.id);

  const strategy = profile
    ? buildStrategyPromptContext({
        user,
        profile,
        trackedCompanies,
        intakeNotes: profile.strategyIntakeNotes,
      })
    : null;

  const fitHighlights = jobs
    .map((j) => {
      const score = parseFitScore(j.fitAnalysis);
      if (!score || score < 55) return null;
      return `- ${j.role} at ${j.company} (${jobStageLabel(j.stage)}): ${score}% fit`;
    })
    .filter(Boolean)
    .slice(0, 6);

  const pipelineSnippet =
    jobs.length === 0
      ? "Pipeline is empty."
      : jobs
          .slice(0, 20)
          .map((j) => {
            const fit = parseFitScore(j.fitAnalysis);
            const fitPart = fit ? `, ${fit}% fit` : "";
            return `- ${j.role} at ${j.company} (${jobStageLabel(j.stage)}${fitPart})`;
          })
          .join("\n");

  const strategySnippet = strategy
    ? [
        `Target roles: ${strategy.targetRoles}`,
        `Timeline: ${strategy.jobTimeline} | Motivation: ${strategy.careerMotivation}`,
        `Priorities: ${strategy.priorities}`,
        strategy.readbackPicture ? `Readback: ${strategy.readbackPicture.slice(0, 400)}` : "",
        strategy.experienceSummary ? `Experience: ${strategy.experienceSummary}` : "",
        profile?.headline ? `Headline: ${profile.headline}` : "",
        profile?.positioningStatement ? `Positioning: ${profile.positioningStatement.slice(0, 300)}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Profile strategy not set up yet.";

  const masterResumeLine = primaryResume
    ? `Master resume on file: "${primaryResume.name}" (primary — use this when citing resume experience)`
    : profile?.resumeText?.trim()
      ? "Resume text synced to profile (no named master file — say \"your profile resume\")"
      : "No resume uploaded yet.";

  const coachLines =
    assignedCoaches.length > 0
      ? assignedCoaches.map((c) => {
          const docs = coachDocs
            .filter((d) => d.coachProfileId === c.coachProfileId)
            .slice(0, 3)
            .map((d) => `${assetTypeLabel(d.type)}: ${d.name}`);
          const docPart = docs.length ? ` — shared: ${docs.join("; ")}` : "";
          return `- ${c.displayName}${c.headline ? ` (${c.headline})` : ""}${docPart}`;
        })
      : [];

  const otherCoachDocs = coachDocs.filter(
    (d) => !assignedCoaches.some((c) => c.coachProfileId === d.coachProfileId),
  );
  if (otherCoachDocs.length > 0) {
    for (const d of otherCoachDocs.slice(0, 3)) {
      coachLines.push(`- ${d.coachProfile.displayName}: ${assetTypeLabel(d.type)} "${d.name}"`);
    }
  }

  const sessionNoteLines = coachSessionNotes
    .map((n) => {
      const bits = [n.sessionNotes, n.homework].filter(Boolean).join(" | ");
      if (!bits) return null;
      return `- ${n.coachProfile.displayName}: ${bits.slice(0, 220)}`;
    })
    .filter(Boolean) as string[];

  const picture = readbackPicture(profile);

  const knowsYouSnippet = [
    masterResumeLine,
    picture ? `Profile summary (readback): ${picture.slice(0, 350)}` : "",
    coachLines.length ? `Assigned coaches & deliverables:\n${coachLines.join("\n")}` : "",
    sessionNoteLines.length ? `Recent coach session notes:\n${sessionNoteLines.join("\n")}` : "",
    fitHighlights.length ? `Strong-fit opportunities:\n${fitHighlights.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const creditsHint = unlimited
    ? "Credits: unlimited (Pro/admin)."
    : scoutCredits.remaining === null
      ? "Credits: check plan."
      : `Scout credits remaining today: ${scoutCredits.remaining} of ${scoutCredits.dailyLimit ?? "?"}.`;

  const pipelineSuggestions = buildAssistantSuggestions(jobs, profile, pageHint);
  const inboxSuggestions = inboxSuggestionsFromSnapshot(inbox);
  const suggestions = [...inboxSuggestions, ...pipelineSuggestions]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);

  const summaryParts = [
    `${jobs.length} job${jobs.length === 1 ? "" : "s"} in pipeline`,
    profile?.targetRoles?.length ? `targeting ${profile.targetRoles.slice(0, 3).join(", ")}` : null,
    primaryResume ? `master resume: ${primaryResume.name}` : null,
    assignedCoaches[0] ? `coach: ${assignedCoaches[0].displayName}` : null,
    suggestions[0]?.title ? `top suggestion: ${suggestions[0].title}` : null,
  ].filter(Boolean);

  return {
    roleMode,
    summary: summaryParts.join("; ") || "Getting started with Kimchi.",
    strategySnippet,
    pipelineSnippet,
    knowsYouSnippet,
    pageHint: formatPageHint(pageHint),
    creditsHint,
    suggestions,
    inbox,
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

  const inboxBlock =
    ctx.inbox.pendingCount > 0
      ? `\nInbox (${ctx.inbox.pendingCount} to review): ${ctx.inbox.activities
          .slice(0, 5)
          .map((a) => a.title || a.snippet || a.companyGuess)
          .filter(Boolean)
          .join("; ")}`
      : "";

  const knowsYouBlock = ctx.knowsYouSnippet?.trim()
    ? `\nWhat you know about this user (cite these sources specifically — do not claim knowledge not listed here):\n${ctx.knowsYouSnippet}`
    : "";

  return `${roleLine}

Search context:
${ctx.strategySnippet}
${knowsYouBlock}

Applications:
${ctx.pipelineSnippet}
${inboxBlock}

${ctx.pageHint}
${ctx.creditsHint}
${suggestionBlock}

Citation rules:
- When referencing their background, say "based on your profile" or cite the master resume by name (e.g. "In your master resume, [filename]…").
- When referencing pipeline roles, name the company and role (e.g. "your Stripe PM application").
- When referencing fit, cite the percentage if listed above.
- When referencing coach work, name the coach and the deliverable (e.g. "Coach Jane's career strategy doc").
- If something isn't in the context above, ask — don't invent employers, coaches, or documents.

You can use mail and calendar tools (list_recent_emails, draft_email_reply, send_email, list_calendar_events, update_job_stage) when the user asks about inbox or scheduling. Summarize email for voice — don't read full messages aloud. Confirm to/subject/body before send_email. Use open_ui_route when they need a screen you can't handle in chat.`;
}

import type { AssistantContextPayload } from "@/lib/kimchi-assistant/types";
import {
  VOICE_HUMAN_LANGUAGE_RULES,
  VOICE_INTERNAL_TOOL_GUIDE,
} from "@/lib/kimchi-assistant/voice-human-rules";
import { profileTargetCompaniesUrl } from "@/lib/workspace-urls";

/** Editable source the voice agent can cite and point users to update. */
export type ContextSourceRef = {
  id: string;
  label: string;
  /** Short label for spoken citation, e.g. "your profile" */
  citeAs: string;
  route: string;
  snippet: string;
};

export function buildContextSourceRefs(ctx: AssistantContextPayload): ContextSourceRef[] {
  const refs: ContextSourceRef[] = [
    {
      id: "profile-target-roles",
      label: "Profile → Target roles",
      citeAs: "your profile",
      route: "/profile",
      snippet: ctx.strategySnippet.split("\n")[0]?.replace("Target roles: ", "") ?? "",
    },
  ];

  if (ctx.targetCompaniesSnippet && !ctx.targetCompaniesSnippet.includes("No companies")) {
    refs.push({
      id: "watchlist-companies",
      label: "Watchlist → Target companies",
      citeAs: "companies you're watching",
      route: "/profile/target-companies",
      snippet: ctx.targetCompaniesSnippet.split("\n")[0]?.replace(/^- /, "") ?? "",
    });
  }

  if (ctx.strategyDocSnippet?.trim()) {
    refs.push({
      id: "career-strategy-doc",
      label: "Profile → Career strategy doc",
      citeAs: "your career strategy doc",
      route: "/profile/career-strategy",
      snippet: ctx.strategyDocSnippet.split("\n")[0]?.slice(0, 120) ?? "",
    });
  }

  if (ctx.knowsYouSnippet?.includes("Master resume")) {
    refs.push({
      id: "master-resume",
      label: "Profile → Assets (master resume)",
      citeAs: "your master resume",
      route: "/profile/assets",
      snippet: ctx.knowsYouSnippet.split("\n")[0]?.slice(0, 120) ?? "",
    });
  }

  if (ctx.activeApplicationsSnippet && !ctx.activeApplicationsSnippet.includes("No roles")) {
    refs.push({
      id: "active-applications",
      label: "Active applications",
      citeAs: "what you're working on right now",
      route: "/opportunities/pipeline",
      snippet: ctx.activeApplicationsSnippet.split("\n").find((l) => l.startsWith("-"))?.slice(0, 120) ?? "",
    });
  }

  if (ctx.inbox.pendingCount > 0) {
    refs.push({
      id: "inbox",
      label: "Inbox → Pending review",
      citeAs: "your inbox",
      route: "/inbox",
      snippet: `${ctx.inbox.pendingCount} email(s) pending review`,
    });
  }

  return refs;
}

/** Format context with explicit source labels for voice citation. */
export function formatLabeledContextForPrompt(ctx: AssistantContextPayload): string {
  const roleLine =
    ctx.roleMode === "coach"
      ? "User is a coach using Kimchi — help with client prep and profile shaping when relevant."
      : ctx.roleMode === "admin"
        ? "User is an admin — stay helpful; do not expose internal system details."
        : "User is a job seeker.";

  const sources = buildContextSourceRefs(ctx);

  const sourceIndex =
    sources.length > 0
      ? `\nWhere things live (internal — cite in plain English, never read labels or routes aloud):\n${sources
          .map((s) => `- ${s.label} → say "${s.citeAs}" if needed · edit path ${s.route}`)
          .join("\n")}`
      : "";

  const suggestionBlock =
    ctx.suggestions.length > 0
      ? `\n[Source: Suggestions]\n${ctx.suggestions.map((s) => `- ${s.title}: ${s.detail}`).join("\n")}`
      : "";

  const inboxBlock =
    ctx.inbox.pendingCount > 0
      ? `\n[Source: Inbox → Pending (${ctx.inbox.pendingCount})]\n${ctx.inbox.activities
          .slice(0, 5)
          .map((a) => {
            const parts = [a.roleGuess, a.companyGuess, a.title || a.snippet].filter(Boolean);
            return `- ${parts.join(" · ")}${a.id ? ` (activity id ${a.id})` : ""}`;
          })
          .join("\n")}`
      : "";

  const knowsYouBlock = ctx.knowsYouSnippet?.trim()
    ? `\n[Source: Profile & coaches]\n${ctx.knowsYouSnippet}`
    : "";

  const strategyDocBlock = ctx.strategyDocSnippet?.trim()
    ? `\n[Source: Career strategy doc]\n${ctx.strategyDocSnippet}`
    : "";

  return `${roleLine}
${sourceIndex}

[Source: Profile → Search context]
${ctx.strategySnippet}

[Source: Watchlist → Target companies]
${ctx.targetCompaniesSnippet}
${strategyDocBlock}
${knowsYouBlock}

[Source: Pipeline → Active applications (applied & interviewing)]
${ctx.activeApplicationsSnippet}

[Source: Pipeline → Full pipeline]
${ctx.pipelineSnippet}
${inboxBlock}

[Source: Session]
${ctx.pageHint}
${ctx.creditsHint}
${suggestionBlock}

${VOICE_HUMAN_LANGUAGE_RULES}

Citation (spoken — plain English only):
- Ground claims naturally: "I see you're targeting…", "You've got something in flight at…", "Your strategy doc mentions…"
- On FIRST reply: acknowledge their ask, say you're catching up on what you know about them, mention ONE specific detail — then ask one question.
- If something might be outdated: "If that's changed, update it in your profile."
- For interview prep: if multiple roles could apply, call list_active_roles and ask which one BEFORE get_job_detail. Never assume.
- After loading one role: confirm interview format in your own words before drilling ("Sounds like mostly behavioral — does that match what you've heard?")
- If you don't know something, ask — don't invent.

${VOICE_INTERNAL_TOOL_GUIDE}`;
}

export function companySourceRoute(companyId: string): string {
  return profileTargetCompaniesUrl(companyId);
}

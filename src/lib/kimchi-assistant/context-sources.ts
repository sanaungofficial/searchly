import type { AssistantContextPayload } from "@/lib/kimchi-assistant/types";
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
      citeAs: "your target companies watchlist",
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
      label: "Pipeline → Active applications",
      citeAs: "your active applications",
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
      ? `\nSource index (cite aloud + tell user where to edit if stale):\n${sources
          .map((s) => `- [${s.label}] → cite as "${s.citeAs}" · update at ${s.route}`)
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

Citation rules (required):
- Prefix claims with where you read them: "According to your profile…", "From your pipeline…", "Your career strategy doc says…", "On your target companies list…"
- On FIRST reply: acknowledge their ask, say you're looking at their file, cite ONE specific detail from a labeled source above.
- If data may be stale: "If that's changed, update it under [route from source index]."
- For interview prep: call get_job_detail (and parse_job_posting if needed) before guessing format — then CONFIRM: "I'm thinking this is mostly behavioral — does that match what you know?"
- If something isn't in context or tools, ask — don't invent.

Voice tools available:
- refresh_context — reload profile/pipeline after they update something
- get_job_detail — full job + fit + interview inference (use job id from pipeline)
- parse_job_posting — fetch JD from job URL
- get_company_brief — watchlist company + intel
- scan_company_roles — refresh open roles at a tracked company
- save_job_note — save prep notes to a pipeline job
- list_recent_emails, get_email, draft_email_reply, send_email, list_calendar_events, update_job_stage, open_ui_route`;
}

export function companySourceRoute(companyId: string): string {
  return profileTargetCompaniesUrl(companyId);
}

const STAGE_LABELS: Record<string, string> = {
  SAVED: "saved",
  APPLYING: "applying",
  APPLIED: "applied",
  SCREENING: "screening",
  INTERVIEWING: "interviewing",
  OFFER: "received an offer",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
};

export function humanStageLabel(stage: string | null | undefined): string {
  if (!stage) return "";
  return STAGE_LABELS[stage] ?? stage.toLowerCase().replace(/_/g, " ");
}

export function trackRoleLabel(company: string, role: string): string {
  const c = company.trim() || "this company";
  const r = role.trim() || "this role";
  return `Track ${r} at ${c}`;
}

export const SAVE_ROLE_LABEL = "Save this role";

export const MATCH_EXISTING_LABEL = "Match one you're tracking";

export function markStageLabel(stage: string | null | undefined): string {
  const label = humanStageLabel(stage);
  if (!label) return "Update status";
  if (stage === "OFFER") return "Mark as offer received";
  if (stage === "APPLIED") return "Mark as applied";
  if (stage === "INTERVIEWING") return "Mark as interviewing";
  return `Mark as ${label}`;
}

export function insightHeadline(activity: {
  job?: { company: string; role: string } | null;
  companyGuess?: string | null;
  roleGuess?: string | null;
  title?: string | null;
}): string {
  if (activity.job) return `${activity.job.company} — ${activity.job.role}`;
  const company = activity.companyGuess?.trim();
  const role = activity.roleGuess?.trim();
  if (company && role) return `${company} — ${role}`;
  if (company) return company;
  return activity.title?.trim() || "Job-related email";
}

export const NOT_JOB_EMAIL_LABEL = "Not a job email";

export const NOT_JOB_EMAIL_TOOLTIP =
  "We save this so Kimchi can learn what to skip. Today it hides this suggestion; smarter personalization from your feedback is coming soon.";

export const INSIGHTS_STRIP_TITLE = "Insights";

export const INSIGHTS_EMPTY_HINT =
  "Tap Check email for updates when you're ready — or open View all for job search tips.";

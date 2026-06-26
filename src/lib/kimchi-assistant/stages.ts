const STAGE_LABELS: Record<string, string> = {
  SAVED: "Saved",
  APPLYING: "Applying",
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export function jobStageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}

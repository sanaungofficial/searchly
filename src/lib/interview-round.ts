/** Interview round options stored in JobMeta.interviewRound. */

export const INTERVIEW_ROUNDS = [
  { id: "phone_screen", label: "Phone screen" },
  { id: "recruiter_screen", label: "Recruiter screen" },
  { id: "round_1", label: "Round 1" },
  { id: "round_2", label: "Round 2" },
  { id: "final", label: "Final" },
  { id: "panel_case", label: "Panel/Case" },
] as const;

export type InterviewRoundId = (typeof INTERVIEW_ROUNDS)[number]["id"];

export function interviewRoundLabel(id: string | null | undefined): string | null {
  if (!id?.trim()) return null;
  return INTERVIEW_ROUNDS.find((r) => r.id === id)?.label ?? id;
}

export function isInterviewRoundId(value: unknown): value is InterviewRoundId {
  return INTERVIEW_ROUNDS.some((r) => r.id === value);
}

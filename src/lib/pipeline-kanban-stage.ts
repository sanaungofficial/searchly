import type { KanbanStage } from "@/components/scout/workspace-data";

/** Map DB JobStage enum → pipeline Kanban tab. Saved = pre-application only (SAVED). */
export const DB_TO_KANBAN: Record<string, KanbanStage> = {
  SAVED: "saved",
  APPLYING: "applied",
  APPLIED: "applied",
  SCREENING: "applied",
  INTERVIEWING: "interview",
  OFFER: "offer",
  REJECTED: "closed",
  WITHDRAWN: "closed",
};

/** Map Kanban tab → default DB stage when user moves a card. */
export const KANBAN_TO_DB: Record<KanbanStage, string> = {
  saved: "SAVED",
  applied: "APPLIED",
  interview: "INTERVIEWING",
  offer: "OFFER",
  closed: "WITHDRAWN",
};

export function dbStageToKanban(stage: string): KanbanStage {
  return DB_TO_KANBAN[stage] ?? "saved";
}

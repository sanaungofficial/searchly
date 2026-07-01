import type { KanbanStage } from "./workspace-data";

export type PipelineColumnId =
  | "role"
  | "company"
  | "stage"
  | "interviewRound"
  | "tags"
  | "location"
  | "saved"
  | "fit";

export type PipelineColumnDef = {
  id: PipelineColumnId;
  label: string;
  defaultVisible: boolean;
  minWidth?: number;
};

export const PIPELINE_COLUMNS: PipelineColumnDef[] = [
  { id: "role", label: "Role", defaultVisible: true, minWidth: 200 },
  { id: "company", label: "Company", defaultVisible: true, minWidth: 140 },
  { id: "stage", label: "Stage", defaultVisible: true, minWidth: 140 },
  { id: "interviewRound", label: "Interview round", defaultVisible: true, minWidth: 130 },
  { id: "tags", label: "Tags", defaultVisible: true, minWidth: 160 },
  { id: "location", label: "Location", defaultVisible: false, minWidth: 120 },
  { id: "saved", label: "Saved", defaultVisible: true, minWidth: 90 },
  { id: "fit", label: "Match", defaultVisible: false, minWidth: 80 },
];

export const PIPELINE_COLUMNS_STORAGE_KEY = "kimchi_pipeline_columns_v2";

export const DEFAULT_PIPELINE_VISIBLE_COLUMNS: PipelineColumnId[] = PIPELINE_COLUMNS.filter(
  (c) => c.defaultVisible,
).map((c) => c.id);

export type PipelineSortField = "role" | "company" | "stage" | "saved" | "fit";

export const PIPELINE_SORT_OPTIONS: { id: PipelineSortField; label: string }[] = [
  { id: "saved", label: "Recently saved" },
  { id: "role", label: "Role" },
  { id: "company", label: "Company" },
  { id: "stage", label: "Stage" },
  { id: "fit", label: "Match score" },
];

export const STAGE_SORT_ORDER: Record<KanbanStage, number> = {
  saved: 0,
  applied: 1,
  interview: 2,
  offer: 3,
  closed: 4,
};

export function readStoredPipelineColumns(): PipelineColumnId[] {
  if (typeof window === "undefined") return DEFAULT_PIPELINE_VISIBLE_COLUMNS;
  try {
    const raw = localStorage.getItem(PIPELINE_COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_PIPELINE_VISIBLE_COLUMNS;
    const parsed = JSON.parse(raw) as PipelineColumnId[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PIPELINE_VISIBLE_COLUMNS;
    return parsed.filter((id) => PIPELINE_COLUMNS.some((c) => c.id === id));
  } catch {
    return DEFAULT_PIPELINE_VISIBLE_COLUMNS;
  }
}

export function storePipelineColumns(columns: PipelineColumnId[]) {
  try {
    localStorage.setItem(PIPELINE_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  } catch {
    /* ignore */
  }
}

export function formatSavedDays(days: number | null | undefined): string {
  if (days == null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

import type { KanbanStage } from "./workspace-data";

export type PipelineColumnId =
  | "role"
  | "company"
  | "tags"
  | "location"
  | "lastModified"
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
  { id: "tags", label: "Tags", defaultVisible: true, minWidth: 160 },
  { id: "location", label: "Location", defaultVisible: false, minWidth: 120 },
  { id: "lastModified", label: "Last modified", defaultVisible: true, minWidth: 110 },
  { id: "fit", label: "Match", defaultVisible: false, minWidth: 80 },
];

export const PIPELINE_COLUMNS_STORAGE_KEY = "kimchi_pipeline_columns_v3";

export const DEFAULT_PIPELINE_VISIBLE_COLUMNS: PipelineColumnId[] = PIPELINE_COLUMNS.filter(
  (c) => c.defaultVisible,
).map((c) => c.id);

export type PipelineSortField = "role" | "company" | "stage" | "lastModified" | "fit";

export const PIPELINE_SORT_OPTIONS: { id: PipelineSortField; label: string }[] = [
  { id: "lastModified", label: "Recently modified" },
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

const LEGACY_COLUMN_IDS = new Set(["stage", "interviewRound", "saved"]);

function migrateLegacyColumnId(id: string): PipelineColumnId | null {
  if (id === "saved") return "lastModified";
  if (LEGACY_COLUMN_IDS.has(id)) return null;
  return PIPELINE_COLUMNS.some((c) => c.id === id) ? (id as PipelineColumnId) : null;
}

export function readStoredPipelineColumns(): PipelineColumnId[] {
  if (typeof window === "undefined") return DEFAULT_PIPELINE_VISIBLE_COLUMNS;
  try {
    const raw = localStorage.getItem(PIPELINE_COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_PIPELINE_VISIBLE_COLUMNS;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PIPELINE_VISIBLE_COLUMNS;
    const migrated = parsed
      .map((id) => migrateLegacyColumnId(id))
      .filter((id): id is PipelineColumnId => id != null);
    return migrated.length > 0 ? migrated : DEFAULT_PIPELINE_VISIBLE_COLUMNS;
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

export function formatLastModified(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

/** SQL migration that creates ImportRun + ImportRunStatus for import history. */
export const IMPORT_RUN_MIGRATION = "supabase/migrations/20260725_import_runs.sql";

export const IMPORT_RUN_MIGRATION_GITHUB_URL =
  "https://github.com/sanaungofficial/searchly/blob/dev/supabase/migrations/20260725_import_runs.sql";

export const IMPORT_HISTORY_UNAVAILABLE_CODE = "IMPORT_HISTORY_UNAVAILABLE";

/** Imports before this date were not persisted to ImportRun (feature shipped ~Jun 29, 2026). */
export const IMPORT_HISTORY_TRACKING_SINCE = "2026-06-30";

export function importHistoryTrackingSinceLabel(): string {
  return new Date(`${IMPORT_HISTORY_TRACKING_SINCE}T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

import type { JobMeta } from "@/lib/job-meta";
import { parseJobMetaFromNotes } from "@/lib/client-import/enrich-jobs";

export function mergeJobMetaIntoNotes(
  notes: string | null | undefined,
  patch: Partial<JobMeta>,
): string {
  const existing = parseJobMetaFromNotes(notes) ?? {};
  const merged: JobMeta = { ...existing };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    (merged as Record<string, unknown>)[key] = value;
  }

  return JSON.stringify(merged);
}

export function parseAppliedAtInput(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

import type { JobMeta } from "@/lib/job-meta";

export const MAX_PIPELINE_TAGS_PER_JOB = 12;
export const MAX_PIPELINE_TAG_LENGTH = 40;

export type PipelineTagColor = "purple" | "green" | "gray" | "salmon" | "yellow" | "black";
export type PipelineTagVariant = "light" | "solid";

export type PipelineTagDefinition = {
  label: string;
  color: PipelineTagColor;
  variant: PipelineTagVariant;
};

export const DEFAULT_PIPELINE_TAG: PipelineTagDefinition = {
  label: "",
  color: "purple",
  variant: "light",
};

export type PipelineTagSummary = PipelineTagDefinition & {
  jobCount: number;
  inLibrary: boolean;
};

type ParsedDataWithTagLibrary = {
  pipelineTagLibrary?: unknown;
};

/** Collapse whitespace and dedupe case-insensitively while preserving first-seen casing. */
export function normalizePipelineTagLabel(raw: string): string | null {
  const tag = raw.trim().replace(/\s+/g, " ");
  if (!tag || tag.length > MAX_PIPELINE_TAG_LENGTH) return null;
  return tag;
}

export function normalizePipelineTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const tag = normalizePipelineTagLabel(item);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_PIPELINE_TAGS_PER_JOB) break;
  }
  return out;
}

export function parseTagsInput(input: string): string[] {
  return normalizePipelineTags(input.split(/[,;]+/));
}

export function parsePipelineTagsFromMeta(meta: JobMeta | null | undefined): string[] {
  return normalizePipelineTags(meta?.pipelineTags);
}

export function parsePipelineTagsFromNotes(notes: string | null | undefined): string[] {
  if (!notes?.trim()) return [];
  try {
    const parsed = JSON.parse(notes) as JobMeta;
    if (!parsed || typeof parsed !== "object") return [];
    return parsePipelineTagsFromMeta(parsed);
  } catch {
    return [];
  }
}

export function mergePipelineTagsIntoMeta(
  meta: JobMeta | null | undefined,
  tags: string[],
): JobMeta {
  return { ...(meta ?? {}), pipelineTags: normalizePipelineTags(tags) };
}

export function mergePipelineTagsIntoNotes(
  notes: string | null | undefined,
  tags: string[],
): string {
  let meta: JobMeta | null = null;
  if (notes?.trim()) {
    try {
      const parsed = JSON.parse(notes) as JobMeta;
      if (parsed && typeof parsed === "object") meta = parsed;
    } catch {
      /* keep null meta */
    }
  }
  return JSON.stringify(mergePipelineTagsIntoMeta(meta, tags));
}

const VALID_COLORS = new Set<PipelineTagColor>([
  "purple",
  "green",
  "gray",
  "salmon",
  "yellow",
  "black",
]);

function normalizeTagColor(raw: unknown): PipelineTagColor {
  return typeof raw === "string" && VALID_COLORS.has(raw as PipelineTagColor)
    ? (raw as PipelineTagColor)
    : DEFAULT_PIPELINE_TAG.color;
}

function normalizeTagVariant(raw: unknown): PipelineTagVariant {
  return raw === "solid" ? "solid" : "light";
}

export function normalizePipelineTagDefinition(raw: unknown): PipelineTagDefinition | null {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string") {
      const label = normalizePipelineTagLabel(raw);
      return label ? { ...DEFAULT_PIPELINE_TAG, label } : null;
    }
    return null;
  }

  const row = raw as Record<string, unknown>;
  const label = normalizePipelineTagLabel(String(row.label ?? ""));
  if (!label) return null;

  return {
    label,
    color: normalizeTagColor(row.color),
    variant: normalizeTagVariant(row.variant),
  };
}

export function normalizePipelineTagLibrary(raw: unknown): PipelineTagDefinition[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PipelineTagDefinition[] = [];
  for (const item of raw) {
    const def = normalizePipelineTagDefinition(item);
    if (!def) continue;
    const key = def.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(def);
  }
  return out;
}

export function parsePipelineTagLibraryFromParsedData(
  parsedData: unknown,
): PipelineTagDefinition[] {
  if (!parsedData || typeof parsedData !== "object") return [];
  return normalizePipelineTagLibrary(
    (parsedData as ParsedDataWithTagLibrary).pipelineTagLibrary,
  );
}

export function mergePipelineTagLibraryIntoParsedData(
  parsedData: unknown,
  library: PipelineTagDefinition[],
): Record<string, unknown> {
  const base =
    parsedData && typeof parsedData === "object"
      ? { ...(parsedData as Record<string, unknown>) }
      : {};
  return {
    ...base,
    pipelineTagLibrary: normalizePipelineTagLibrary(library),
  };
}

export function resolvePipelineTagDefinition(
  label: string,
  library: PipelineTagDefinition[],
): PipelineTagDefinition {
  const key = label.toLowerCase();
  const match = library.find((tag) => tag.label.toLowerCase() === key);
  return match ?? { label, color: DEFAULT_PIPELINE_TAG.color, variant: DEFAULT_PIPELINE_TAG.variant };
}

export function upsertPipelineTagDefinition(
  library: PipelineTagDefinition[],
  next: PipelineTagDefinition,
): PipelineTagDefinition[] {
  const key = next.label.toLowerCase();
  const filtered = library.filter((tag) => tag.label.toLowerCase() !== key);
  return normalizePipelineTagLibrary([...filtered, next]);
}

export function mergeTagLibraries(
  libraryTags: PipelineTagDefinition[],
  jobTags: string[][],
): PipelineTagDefinition[] {
  const counts = new Map<string, PipelineTagDefinition & { jobCount: number }>();

  for (const def of normalizePipelineTagLibrary(libraryTags)) {
    const key = def.label.toLowerCase();
    counts.set(key, { ...def, jobCount: 0 });
  }

  for (const tags of jobTags) {
    for (const label of normalizePipelineTags(tags)) {
      const key = label.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.jobCount += 1;
      } else {
        counts.set(key, {
          ...resolvePipelineTagDefinition(label, libraryTags),
          jobCount: 1,
        });
      }
    }
  }

  return [...counts.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(({ label, color, variant }) => ({ label, color, variant }));
}

export function summarizePipelineTags(
  libraryTags: PipelineTagDefinition[],
  jobTags: string[][],
): PipelineTagSummary[] {
  const library = new Set(
    normalizePipelineTagLibrary(libraryTags).map((t) => t.label.toLowerCase()),
  );
  const counts = new Map<string, PipelineTagDefinition & { jobCount: number }>();

  for (const def of normalizePipelineTagLibrary(libraryTags)) {
    const key = def.label.toLowerCase();
    counts.set(key, { ...def, jobCount: 0 });
  }

  for (const tags of jobTags) {
    for (const label of normalizePipelineTags(tags)) {
      const key = label.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.jobCount += 1;
      } else {
        counts.set(key, {
          ...resolvePipelineTagDefinition(label, libraryTags),
          jobCount: 1,
        });
      }
    }
  }

  return [...counts.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((row) => ({
      label: row.label,
      color: row.color,
      variant: row.variant,
      jobCount: row.jobCount,
      inLibrary: library.has(row.label.toLowerCase()),
    }));
}

import * as XLSX from "xlsx";
import type { ImportPipelineJob, ImportRow } from "@/lib/client-import/types";
import { detectJobTrackerColumns, normJobHeader } from "@/lib/client-import/job-columns";
import type { JobStage } from "@prisma/client";
import {
  IMPORT_JOB_STAGES,
  mapImportJobStage,
  parseImportApproved,
  tryAutoMapImportStatusText,
  type ImportStatusValueMapping,
} from "@/lib/client-import/job-status-map";
import { jobStageLabel } from "@/lib/kimchi-assistant/stages";
import { importJobDedupeKey } from "@/lib/client-import/job-url";

export type JobTrackerDestinationFieldId =
  | "company"
  | "role"
  | "url"
  | "status"
  | "yesNo"
  | "notes"
  | "appliedAt"
  | "resumeUrl";

export type JobTrackerDestinationField = {
  id: JobTrackerDestinationFieldId;
  label: string;
  required: boolean;
  description?: string;
};

export const JOB_TRACKER_DESTINATION_FIELDS: JobTrackerDestinationField[] = [
  { id: "company", label: "Company", required: true },
  { id: "role", label: "Job title", required: true },
  { id: "url", label: "Job URL", required: false },
  { id: "status", label: "Status / stage", required: false, description: "Application status or pipeline stage" },
  { id: "yesNo", label: "Coach approval (Yes/No)", required: false },
  { id: "appliedAt", label: "Date applied", required: false },
  { id: "notes", label: "Notes", required: false },
  { id: "resumeUrl", label: "Resume link", required: false },
];

export type JobTrackerColumnMapping = {
  columnIndex: number;
  header: string;
  skipped: boolean;
  destination: JobTrackerDestinationFieldId | null;
  sampleValues: string[];
  isEmpty: boolean;
};

export type JobTrackerSheetPreview = {
  filename: string;
  sheetName: string;
  headerRowIndex: number;
  columns: JobTrackerColumnMapping[];
  dataRowCount: number;
  /** Compact grid for client-side remapping without re-upload. */
  rows: string[][];
};

export type JobTrackerStatusValueMapping = ImportStatusValueMapping;

export type JobTrackerImportOptions = {
  dedupeEnabled: boolean;
  matchField: "url" | "company_role";
  onMatch: "add_missing" | "update_all" | "skip";
  onNoMatch: "create" | "skip";
  statusValueMapping?: JobTrackerStatusValueMapping;
};

export const DEFAULT_JOB_TRACKER_IMPORT_OPTIONS: JobTrackerImportOptions = {
  dedupeEnabled: true,
  matchField: "url",
  onMatch: "add_missing",
  onNoMatch: "create",
};

export const KIMCHI_PIPELINE_STAGES = IMPORT_JOB_STAGES;

export type JobTrackerStatusValueRow = {
  rawValue: string;
  count: number;
  autoMappedStage: JobStage | null;
  userStage: JobStage | null;
};

export type JobTrackerYesNoValueRow = {
  rawValue: string;
  count: number;
  parsed: boolean | null;
};

export function pipelineStageOptions(): Array<{ value: JobStage; label: string }> {
  return KIMCHI_PIPELINE_STAGES.map((stage) => ({ value: stage, label: jobStageLabel(stage) }));
}

const HEADER_PATTERNS: Record<JobTrackerDestinationFieldId, RegExp[]> = {
  company: [/company name/, /^company$/, /^company /, /employer/],
  role: [/job title/, /^title$/, /^role$/, /position/],
  url: [/^url$/, /job url/, /posting link/, /job description link/, /careers link/],
  status: [/application status/, /app status/, /^status$/, /pipeline stage/, /^stage$/],
  yesNo: [/^yes no$/, /^yes\/no$/, /^approved$/, /coach approv/, /^apply\?/],
  notes: [/^notes/, /please add notes/],
  appliedAt: [/application date/, /date applied/, /applied date/],
  resumeUrl: [/resume link/, /resume url/, /^resume$/],
};

let rowCounter = 0;
function nextJobId(): string {
  rowCounter += 1;
  return `job_${rowCounter}`;
}

export function resetJobMappingIds(): void {
  rowCounter = 0;
}

function normalizeSheetUrl(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function cleanCompanyName(raw: string, jobUrl: string | null): string {
  const text = raw.trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) {
    try {
      const host = new URL(text).hostname.replace(/^www\./, "");
      const base = host.split(".")[0] ?? host;
      return base.charAt(0).toUpperCase() + base.slice(1);
    } catch {
      return text;
    }
  }
  return text;
}

function scoreHeaderRow(row: unknown[]): number {
  const joined = row.map((c) => normJobHeader(c)).join(" ");
  let score = 0;
  if (/company/.test(joined)) score += 2;
  if (/job title|^title|role/.test(joined)) score += 2;
  if (/application status|app status/.test(joined)) score += 2;
  if (/yes no|yes\/no/.test(joined)) score += 1;
  if (/\burl\b|job description|posting link/.test(joined)) score += 1;
  if (/application date|date applied/.test(joined)) score += 1;
  if (/resume link|resume url/.test(joined)) score += 1;
  return score;
}

function findBestHeaderRow(rows: unknown[][], minScore = 4): number {
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const score = scoreHeaderRow(rows[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= minScore ? bestIdx : rows.length ? 0 : -1;
}

function splitPasteLines(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n").filter(Boolean);
  return lines.map((line) => {
    if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
    if (line.includes(";") && !line.includes(",")) return line.split(";").map((c) => c.trim());
    return line.split(",").map((c) => c.trim());
  });
}

function findSheet(wb: XLSX.WorkBook, patterns: RegExp[]): string | null {
  for (const name of wb.SheetNames) {
    const lower = name.trim().toLowerCase();
    if (patterns.some((p) => p.test(lower))) return name;
  }
  return null;
}

function colFromPatterns(headers: unknown[], patterns: RegExp[], exclude: number[] = []): number {
  const excluded = new Set(exclude);
  for (let i = 0; i < headers.length; i++) {
    if (excluded.has(i)) continue;
    const h = normJobHeader(headers[i]);
    if (!h) continue;
    if (patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

/** Fuzzy header match → suggested destination per column index. */
export function suggestJobTrackerMappings(headers: unknown[]): Map<number, JobTrackerDestinationFieldId> {
  const detected = detectJobTrackerColumns(headers);
  const mapping = new Map<number, JobTrackerDestinationFieldId>();
  const fieldByCol: Array<[number, JobTrackerDestinationFieldId]> = [
    [detected.companyCol, "company"],
    [detected.roleCol, "role"],
    [detected.urlCol, "url"],
    [detected.statusCol, "status"],
    [detected.yesNoCol, "yesNo"],
    [detected.notesCol, "notes"],
    [detected.dateCol, "appliedAt"],
    [detected.resumeCol, "resumeUrl"],
  ];
  for (const [col, field] of fieldByCol) {
    if (col >= 0) mapping.set(col, field);
  }

  const usedDest = new Set(mapping.values());
  for (let i = 0; i < headers.length; i++) {
    if (mapping.has(i)) continue;
    const h = normJobHeader(headers[i]);
    if (!h) continue;
    for (const field of JOB_TRACKER_DESTINATION_FIELDS) {
      if (usedDest.has(field.id)) continue;
      if (HEADER_PATTERNS[field.id].some((p) => p.test(h))) {
        mapping.set(i, field.id);
        usedDest.add(field.id);
        break;
      }
    }
  }
  return mapping;
}

function collectSampleValues(rows: string[][], headerIdx: number, col: number, max = 3): string[] {
  const samples: string[] = [];
  for (let r = headerIdx + 1; r < rows.length && samples.length < max; r++) {
    const val = (rows[r]?.[col] ?? "").trim();
    if (val) samples.push(val);
  }
  return samples;
}

function buildColumnMappings(rows: string[][], headerIdx: number): JobTrackerColumnMapping[] {
  const headers = rows[headerIdx] ?? [];
  const suggestions = suggestJobTrackerMappings(headers);
  const maxCol = Math.max(headers.length, ...rows.slice(headerIdx + 1, headerIdx + 6).map((r) => r.length));
  const columns: JobTrackerColumnMapping[] = [];

  for (let c = 0; c < maxCol; c++) {
    const header = String(headers[c] ?? "").trim() || `Column ${String.fromCharCode(65 + (c % 26))}`;
    const samples = collectSampleValues(rows, headerIdx, c);
    const isEmpty = samples.length === 0;
    const suggested = suggestions.get(c) ?? null;
    columns.push({
      columnIndex: c,
      header,
      skipped: isEmpty,
      destination: isEmpty ? null : suggested,
      sampleValues: samples,
      isEmpty,
    });
  }

  return columns.filter((col) => col.header || !col.isEmpty);
}

function countDataRows(rows: string[][], headerIdx: number): number {
  let count = 0;
  for (let r = headerIdx + 1; r < rows.length; r++) {
    if ((rows[r] ?? []).some((cell) => String(cell ?? "").trim())) count++;
  }
  return count;
}

function rowsToStringGrid(raw: unknown[][]): string[][] {
  return raw.map((row) => (row as unknown[]).map((cell) => String(cell ?? "").trim()));
}

export function parseJobTrackerSheetFromWorkbook(
  buffer: Buffer,
  filename: string,
  opts?: { preferInterviewSheet?: boolean },
): JobTrackerSheetPreview {
  const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true });
  const sheetName =
    (opts?.preferInterviewSheet ? findSheet(wb, [/interview tracker/]) : null) ??
    findSheet(wb, [/job tracker/, /application tracker/, /applications/]) ??
    findSheet(wb, [/interview tracker/]) ??
    wb.SheetNames[0] ??
    "Sheet1";

  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("No worksheet found in file.");

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
  const rows = rowsToStringGrid(raw);
  const headerRowIndex = findBestHeaderRow(raw);
  if (headerRowIndex < 0) throw new Error("Could not detect a header row — include Company and Job Title columns.");

  return {
    filename,
    sheetName,
    headerRowIndex,
    columns: buildColumnMappings(rows, headerRowIndex),
    dataRowCount: countDataRows(rows, headerRowIndex),
    rows,
  };
}

export function parseJobTrackerSheetFromText(text: string, filename: string): JobTrackerSheetPreview {
  const raw = splitPasteLines(text);
  if (!raw.length) throw new Error("No rows found in pasted text.");
  const rows = rowsToStringGrid(raw);
  const headerRowIndex = findBestHeaderRow(raw, 3);
  if (headerRowIndex < 0) throw new Error("Could not detect a header row — include Company and Job Title columns.");

  return {
    filename: filename || "pasted-rows.txt",
    sheetName: "Pasted rows",
    headerRowIndex,
    columns: buildColumnMappings(rows, headerRowIndex),
    dataRowCount: countDataRows(rows, headerRowIndex),
    rows,
  };
}

function colForDestination(columns: JobTrackerColumnMapping[], field: JobTrackerDestinationFieldId): number {
  const match = columns.find((c) => !c.skipped && c.destination === field);
  return match?.columnIndex ?? -1;
}

function cellAt(rows: string[][], r: number, c: number): string {
  if (c < 0) return "";
  return (rows[r]?.[c] ?? "").trim();
}

export function countMappedColumns(columns: JobTrackerColumnMapping[]): { mapped: number; total: number; unmapped: number } {
  const active = columns.filter((c) => !c.skipped && !c.isEmpty);
  const mapped = active.filter((c) => c.destination).length;
  return { mapped, total: active.length, unmapped: active.length - mapped };
}

export function validateJobTrackerMapping(columns: JobTrackerColumnMapping[]): string | null {
  const active = columns.filter((c) => !c.skipped && !c.isEmpty && c.destination);
  const company = active.some((c) => c.destination === "company");
  const role = active.some((c) => c.destination === "role");
  if (!company || !role) return "Map at least Company and Job title columns to continue.";

  const seen = new Set<JobTrackerDestinationFieldId>();
  for (const col of active) {
    if (!col.destination) continue;
    if (seen.has(col.destination)) {
      const label = JOB_TRACKER_DESTINATION_FIELDS.find((f) => f.id === col.destination)?.label ?? col.destination;
      return `Only one column can map to ${label}.`;
    }
    seen.add(col.destination);
  }
  return null;
}

export function skipAllUnmapped(columns: JobTrackerColumnMapping[]): JobTrackerColumnMapping[] {
  return columns.map((col) =>
    !col.skipped && !col.isEmpty && !col.destination ? { ...col, skipped: true } : col,
  );
}

function collectUniqueFieldValues(
  preview: JobTrackerSheetPreview,
  columns: JobTrackerColumnMapping[],
  field: JobTrackerDestinationFieldId,
): Array<{ value: string; count: number }> {
  const col = colForDestination(columns, field);
  if (col < 0) return [];

  const counts = new Map<string, number>();
  for (let r = preview.headerRowIndex + 1; r < preview.rows.length; r++) {
    const companyCol = colForDestination(columns, "company");
    const roleCol = colForDestination(columns, "role");
    const company = cellAt(preview.rows, r, companyCol);
    const role = cellAt(preview.rows, r, roleCol);
    if (!company && !role) continue;

    const val = cellAt(preview.rows, r, col);
    if (!val) continue;
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function analyzeStatusValueMappings(
  preview: JobTrackerSheetPreview,
  columns: JobTrackerColumnMapping[],
  mapping?: JobTrackerStatusValueMapping,
): {
  hasStatusColumn: boolean;
  values: JobTrackerStatusValueRow[];
  unmatchedValues: JobTrackerStatusValueRow[];
  defaultUnmatchedStage: JobStage | null;
} {
  const hasStatusColumn = colForDestination(columns, "status") >= 0;
  const defaultUnmatchedStage = mapping?.defaultUnmatchedStage ?? null;
  const values: JobTrackerStatusValueRow[] = collectUniqueFieldValues(preview, columns, "status").map(
    ({ value, count }) => {
      const autoMappedStage = tryAutoMapImportStatusText(value);
      const userStage = mapping?.valueToStage[value] ?? null;
      return { rawValue: value, count, autoMappedStage, userStage };
    },
  );

  const unmatchedValues = values.filter((row) => !row.autoMappedStage);
  return { hasStatusColumn, values, unmatchedValues, defaultUnmatchedStage };
}

export function analyzeYesNoValues(
  preview: JobTrackerSheetPreview,
  columns: JobTrackerColumnMapping[],
): { hasYesNoColumn: boolean; values: JobTrackerYesNoValueRow[]; unrecognized: JobTrackerYesNoValueRow[] } {
  const hasYesNoColumn = colForDestination(columns, "yesNo") >= 0;
  const values: JobTrackerYesNoValueRow[] = collectUniqueFieldValues(preview, columns, "yesNo").map(
    ({ value, count }) => ({
      rawValue: value,
      count,
      parsed: parseImportApproved(value),
    }),
  );
  const unrecognized = values.filter((row) => row.parsed === null);
  return { hasYesNoColumn, values, unrecognized };
}

export function validateStatusValueMapping(
  preview: JobTrackerSheetPreview,
  columns: JobTrackerColumnMapping[],
  mapping?: JobTrackerStatusValueMapping,
): string | null {
  const { hasStatusColumn, unmatchedValues, defaultUnmatchedStage } = analyzeStatusValueMappings(
    preview,
    columns,
    mapping,
  );
  if (!hasStatusColumn || unmatchedValues.length === 0) return null;

  const unresolved = unmatchedValues.filter((row) => !row.userStage && !defaultUnmatchedStage);
  if (unresolved.length === 0) return null;

  const sample = unresolved
    .slice(0, 3)
    .map((row) => `"${row.rawValue}"`)
    .join(", ");
  const suffix = unresolved.length > 3 ? ` (+${unresolved.length - 3} more)` : "";
  return `Map unmatched status values to Kimchi stages${defaultUnmatchedStage ? "" : " or choose a default stage"}: ${sample}${suffix}.`;
}

export function buildStatusValueMappingFromRows(
  rows: JobTrackerStatusValueRow[],
  defaultUnmatchedStage: JobStage | null,
): JobTrackerStatusValueMapping {
  const valueToStage: Record<string, JobStage> = {};
  for (const row of rows) {
    if (row.userStage) valueToStage[row.rawValue] = row.userStage;
  }
  return { valueToStage, defaultUnmatchedStage };
}

export function buildPipelineJobsFromMapping(
  preview: JobTrackerSheetPreview,
  columns: JobTrackerColumnMapping[],
  opts?: {
    inferInterviewStage?: boolean;
    source?: string;
    statusValueMapping?: JobTrackerStatusValueMapping;
  },
): ImportRow<ImportPipelineJob>[] {
  resetJobMappingIds();
  const { rows, headerRowIndex } = preview;
  const companyCol = colForDestination(columns, "company");
  const roleCol = colForDestination(columns, "role");
  if (companyCol < 0 || roleCol < 0) return [];

  const urlCol = colForDestination(columns, "url");
  const statusCol = colForDestination(columns, "status");
  const yesNoCol = colForDestination(columns, "yesNo");
  const notesCol = colForDestination(columns, "notes");
  const dateCol = colForDestination(columns, "appliedAt");
  const resumeCol = colForDestination(columns, "resumeUrl");
  const source = opts?.source ?? preview.sheetName;

  const out: ImportRow<ImportPipelineJob>[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    let company = cellAt(rows, r, companyCol);
    let role = cellAt(rows, r, roleCol);
    if (!company && !role) continue;

    const urlRaw = cellAt(rows, r, urlCol);
    const url = normalizeSheetUrl(urlRaw);
    company = cleanCompanyName(company, url);
    role = role.trim();
    if (!company || !role) continue;
    if (/^company|^job title|^title$/i.test(company)) continue;

    const statusRaw = cellAt(rows, r, statusCol);
    const yesNoRaw = cellAt(rows, r, yesNoCol);
    const notes = notesCol >= 0 ? cellAt(rows, r, notesCol) || null : null;
    const appliedAtRaw = cellAt(rows, r, dateCol);
    const resumeRaw = cellAt(rows, r, resumeCol);

    let stage = mapImportJobStage(
      {
        statusRaw,
        approved: parseImportApproved(yesNoRaw),
        appliedAt: appliedAtRaw || null,
      },
      opts?.statusValueMapping,
    );

    if (opts?.inferInterviewStage) {
      for (const col of columns) {
        if (col.skipped || !col.destination) continue;
        const h = normJobHeader(col.header);
        const val = cellAt(rows, r, col.columnIndex);
        if (!val) continue;
        if (/offer/.test(h)) stage = "OFFER";
        else if (/interview|assessment/.test(h)) stage = "INTERVIEWING";
        else if (/phone screen/.test(h)) stage = "SCREENING";
      }
    }

    out.push({
      id: nextJobId(),
      selected: true,
      source,
      data: {
        company,
        role,
        url,
        stage,
        notes,
        appliedAt: appliedAtRaw || null,
        approved: parseImportApproved(yesNoRaw),
        resumeUrl: normalizeSheetUrl(resumeRaw),
      },
    });
  }

  return dedupeImportJobs(out);
}

function dedupeImportJobs(rows: ImportRow<ImportPipelineJob>[]): ImportRow<ImportPipelineJob>[] {
  const byKey = new Map<string, ImportRow<ImportPipelineJob>>();
  for (const row of rows) {
    const key = importJobDedupeKey(row.data);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const mergedStage =
      existing.data.stage === "REJECTED" || row.data.stage === "REJECTED"
        ? "REJECTED"
        : row.data.stage === "INTERVIEWING" || existing.data.stage === "INTERVIEWING"
          ? "INTERVIEWING"
          : row.data.stage;
    byKey.set(key, {
      ...existing,
      data: {
        ...existing.data,
        url: existing.data.url ?? row.data.url,
        stage: mergedStage,
        notes: [existing.data.notes, row.data.notes].filter(Boolean).join(" · ") || null,
      },
    });
  }
  return [...byKey.values()];
}

export function buildJobTrackerImportPreview(
  sheetPreview: JobTrackerSheetPreview,
  columns: JobTrackerColumnMapping[],
  inferInterviewStage: boolean,
  statusValueMapping?: JobTrackerStatusValueMapping,
): { pipelineJobs: ImportRow<ImportPipelineJob>[]; warnings: string[] } {
  const validation = validateJobTrackerMapping(columns);
  if (validation) return { pipelineJobs: [], warnings: [validation] };

  const statusValidation = validateStatusValueMapping(sheetPreview, columns, statusValueMapping);
  if (statusValidation) return { pipelineJobs: [], warnings: [statusValidation] };

  const pipelineJobs = buildPipelineJobsFromMapping(sheetPreview, columns, {
    inferInterviewStage,
    source: sheetPreview.sheetName,
    statusValueMapping,
  });

  const warnings: string[] = [];
  if (!pipelineJobs.length) {
    warnings.push("No job rows found with current mapping — check Company and Job title columns.");
  } else {
    warnings.push(`${pipelineJobs.length} job(s) ready to import.`);
  }

  const { unrecognized } = analyzeYesNoValues(sheetPreview, columns);
  if (unrecognized.length) {
    warnings.push(
      `${unrecognized.length} Yes/No value(s) were not recognized — coach approval gating may not apply for those rows.`,
    );
  }

  return { pipelineJobs, warnings };
}

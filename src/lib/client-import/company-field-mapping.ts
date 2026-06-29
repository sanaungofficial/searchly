import * as XLSX from "xlsx";
import type { ImportRow } from "@/lib/client-import/types";
import type { SuggestedTrackedCompany } from "@/lib/intake-tracked-companies";
import { normJobHeader } from "@/lib/client-import/job-columns";

export type CompaniesDestinationFieldId = "company" | "priority";

export type CompaniesDestinationField = {
  id: CompaniesDestinationFieldId;
  label: string;
  required: boolean;
  description?: string;
};

export const COMPANIES_DESTINATION_FIELDS: CompaniesDestinationField[] = [
  { id: "company", label: "Company", required: true },
  { id: "priority", label: "Priority", required: false, description: "High / Medium / Low" },
];

export type CompaniesColumnMapping = {
  columnIndex: number;
  header: string;
  skipped: boolean;
  destination: CompaniesDestinationFieldId | null;
  sampleValues: string[];
  isEmpty: boolean;
};

export type CompaniesSheetPreview = {
  filename: string;
  sheetName: string;
  headerRowIndex: number;
  columns: CompaniesColumnMapping[];
  dataRowCount: number;
  rows: string[][];
  /** Row index → section category label (from colored/header rows). */
  rowCategories?: Record<number, string>;
};

export type CompanyImportOptions = {
  dedupeEnabled: boolean;
  onMatch: "add_missing" | "replace" | "skip";
  onNoMatch: "create" | "skip";
  /** When true, unmapped descriptive columns are appended to notes automatically. */
  includeUnmappedInNotes: boolean;
};

export const DEFAULT_COMPANY_IMPORT_OPTIONS: CompanyImportOptions = {
  dedupeEnabled: true,
  onMatch: "add_missing",
  onNoMatch: "create",
  includeUnmappedInNotes: true,
};

const HEADER_PATTERNS: Record<CompaniesDestinationFieldId, RegExp[]> = {
  company: [/^company$/, /company name/, /^name$/, /employer/],
  priority: [/^priority$/, /\bpriority\b/, /tier/, /rank/],
};

const SECTION_HEADER_PATTERNS = [
  /^primary industries$/i,
  /^secondary$/i,
  /^engineering\/asset services$/i,
  /industries$/i,
  /^category:/i,
];

let rowCounter = 0;
function nextCompanyId(): string {
  rowCounter += 1;
  return `co_${rowCounter}`;
}

export function resetCompanyMappingIds(): void {
  rowCounter = 0;
}

function normHeader(value: unknown): string {
  return normJobHeader(value);
}

function scoreCompaniesHeaderRow(row: unknown[]): number {
  const joined = row.map((c) => normHeader(c)).join(" ");
  let score = 0;
  if (/\bcompany\b|^name\b/.test(joined)) score += 3;
  if (/priority|tier/.test(joined)) score += 2;
  if (/industry|location|fit|notes|drive|asset/.test(joined)) score += 2;
  return score;
}

function findBestHeaderRow(rows: unknown[][], minScore = 3): number {
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const score = scoreCompaniesHeaderRow(rows[i] ?? []);
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

function rowsToStringGrid(raw: unknown[][]): string[][] {
  return raw.map((row) => (row as unknown[]).map((cell) => String(cell ?? "").trim()));
}

function collectSampleValues(rows: string[][], headerIdx: number, col: number, max = 3): string[] {
  const samples: string[] = [];
  for (let r = headerIdx + 1; r < rows.length && samples.length < max; r++) {
    const val = (rows[r]?.[col] ?? "").trim();
    if (val && !looksLikeSectionHeader(val)) samples.push(val);
  }
  return samples;
}

/** Fuzzy header match → suggested company / priority column only. */
export function suggestCompaniesMappings(headers: unknown[]): Map<number, CompaniesDestinationFieldId> {
  const mapping = new Map<number, CompaniesDestinationFieldId>();
  const usedSingle = new Set<CompaniesDestinationFieldId>();

  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i]);
    if (!h) continue;
    for (const field of COMPANIES_DESTINATION_FIELDS) {
      if (usedSingle.has(field.id)) continue;
      if (HEADER_PATTERNS[field.id].some((p) => p.test(h))) {
        mapping.set(i, field.id);
        usedSingle.add(field.id);
        break;
      }
    }
  }
  return mapping;
}

function buildColumnMappings(rows: string[][], headerIdx: number): CompaniesColumnMapping[] {
  const headers = rows[headerIdx] ?? [];
  const suggestions = suggestCompaniesMappings(headers);
  const maxCol = Math.max(headers.length, ...rows.slice(headerIdx + 1, headerIdx + 8).map((r) => r.length));
  const columns: CompaniesColumnMapping[] = [];

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

export function looksLikeSectionHeader(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (SECTION_HEADER_PATTERNS.some((p) => p.test(t))) return true;
  if (/^(primary|secondary|engineering)\b/i.test(t) && /industries|services|sector/i.test(t)) return true;
  return false;
}

/** Detect category labels from section-header rows (text or styled header rows in xlsx). */
function detectRowCategories(
  rows: string[][],
  headerIdx: number,
  companyCol: number,
  styledCategories?: Record<number, string>,
): Record<number, string> {
  const categories: Record<number, string> = { ...(styledCategories ?? {}) };
  let currentCategory: string | null = null;

  for (let r = headerIdx + 1; r < rows.length; r++) {
    if (categories[r]) {
      currentCategory = categories[r]!;
      continue;
    }

    const companyVal = cellAt(rows, r, companyCol);
    const rowText = (rows[r] ?? []).filter(Boolean).join(" ").trim();

    if (looksLikeSectionHeader(companyVal) || (rowText && looksLikeSectionHeader(rowText) && !companyVal.includes("@"))) {
      const label = companyVal || rowText;
      currentCategory = label.replace(/^category:\s*/i, "").trim();
      categories[r] = currentCategory;
      continue;
    }

    if (currentCategory && companyVal) {
      categories[r] = currentCategory;
    }
  }

  return categories;
}

function extractStyledCategoryRows(sheet: XLSX.WorkSheet, headerIdx: number, maxRow: number): Record<number, string> {
  const out: Record<number, string> = {};
  if (!sheet["!ref"]) return out;

  for (let r = headerIdx + 1; r <= maxRow; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 0 });
    const cell = sheet[cellRef];
    if (!cell || cell.v == null) continue;
    const text = String(cell.v).trim();
    if (!text) continue;

    const styleIdx = cell.s;
    const hasFill =
      styleIdx != null &&
      typeof styleIdx === "object" &&
      styleIdx != null &&
      "fgColor" in (styleIdx as object);

    if (hasFill || looksLikeSectionHeader(text)) {
      const nonEmpty = countNonEmptyCellsInRow(sheet, r);
      if (nonEmpty <= 2 && looksLikeSectionHeader(text)) {
        out[r] = text.replace(/^category:\s*/i, "").trim();
      }
    }
  }
  return out;
}

function countNonEmptyCellsInRow(sheet: XLSX.WorkSheet, rowIdx: number): number {
  let count = 0;
  for (let c = 0; c < 20; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: rowIdx, c })];
    if (cell?.v != null && String(cell.v).trim()) count++;
  }
  return count;
}

export function parseCompaniesSheetFromWorkbook(buffer: Buffer, filename: string): CompaniesSheetPreview {
  const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true });
  const sheetName =
    findSheet(wb, [/target compan/, /companies list/, /watchlist/, /dream compan/]) ??
    findSheet(wb, [/compan/]) ??
    wb.SheetNames[0] ??
    "Sheet1";

  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("No worksheet found in file.");

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
  const rows = rowsToStringGrid(raw);
  const headerRowIndex = findBestHeaderRow(raw);
  if (headerRowIndex < 0) throw new Error("Could not detect a header row — include a Company column.");

  const columns = buildColumnMappings(rows, headerRowIndex);
  const companyCol = colForDestination(columns, "company");
  const styledCategories =
    companyCol >= 0 ? extractStyledCategoryRows(sheet, headerRowIndex, rows.length - 1) : {};
  const rowCategories =
    companyCol >= 0 ? detectRowCategories(rows, headerRowIndex, companyCol, styledCategories) : {};

  return {
    filename,
    sheetName,
    headerRowIndex,
    columns,
    dataRowCount: countDataRows(rows, headerRowIndex),
    rows,
    rowCategories,
  };
}

export function parseCompaniesSheetFromText(text: string, filename: string): CompaniesSheetPreview {
  const raw = splitPasteLines(text);
  if (!raw.length) throw new Error("No rows found in pasted text.");
  const rows = rowsToStringGrid(raw);
  const headerRowIndex = findBestHeaderRow(raw, 2);
  if (headerRowIndex < 0) throw new Error("Could not detect a header row — include a Company column.");

  const columns = buildColumnMappings(rows, headerRowIndex);
  const companyCol = colForDestination(columns, "company");
  const rowCategories =
    companyCol >= 0 ? detectRowCategories(rows, headerRowIndex, companyCol) : undefined;

  return {
    filename: filename || "pasted-rows.txt",
    sheetName: "Pasted rows",
    headerRowIndex,
    columns,
    dataRowCount: countDataRows(rows, headerRowIndex),
    rows,
    rowCategories,
  };
}

export function colForDestination(columns: CompaniesColumnMapping[], field: CompaniesDestinationFieldId): number {
  const match = columns.find((c) => !c.skipped && c.destination === field);
  return match?.columnIndex ?? -1;
}

/** Columns that will fold into notes (everything except company, priority, skipped, empty). */
export function noteColumnsFromMapping(columns: CompaniesColumnMapping[]): CompaniesColumnMapping[] {
  const companyCol = colForDestination(columns, "company");
  const priorityCol = colForDestination(columns, "priority");
  return columns.filter(
    (c) =>
      !c.skipped &&
      !c.isEmpty &&
      c.columnIndex !== companyCol &&
      c.columnIndex !== priorityCol,
  );
}

export function applyCompaniesFieldSelection(
  columns: CompaniesColumnMapping[],
  companyCol: number,
  priorityCol: number | null,
): CompaniesColumnMapping[] {
  return columns.map((col) => {
    let destination: CompaniesDestinationFieldId | null = null;
    if (col.columnIndex === companyCol) destination = "company";
    else if (priorityCol != null && col.columnIndex === priorityCol) destination = "priority";
    return { ...col, destination, skipped: destination ? false : col.skipped };
  });
}

export function countMappedColumns(columns: CompaniesColumnMapping[]): {
  companyMapped: boolean;
  priorityMapped: boolean;
  notesColumnCount: number;
} {
  const companyCol = colForDestination(columns, "company");
  const priorityCol = colForDestination(columns, "priority");
  return {
    companyMapped: companyCol >= 0,
    priorityMapped: priorityCol >= 0,
    notesColumnCount: noteColumnsFromMapping(columns).length,
  };
}

export function validateCompaniesMapping(columns: CompaniesColumnMapping[]): string | null {
  const active = columns.filter((c) => !c.skipped && !c.isEmpty && c.destination);
  const company = active.some((c) => c.destination === "company");
  if (!company) return "Map a Company column to continue.";

  const priorityCols = active.filter((c) => c.destination === "priority");
  if (priorityCols.length > 1) return "Only one column can map to Priority.";

  const companyCols = active.filter((c) => c.destination === "company");
  if (companyCols.length > 1) return "Only one column can map to Company.";

  return null;
}

export function skipAllUnmapped(columns: CompaniesColumnMapping[]): CompaniesColumnMapping[] {
  return columns.map((col) =>
    !col.skipped && !col.isEmpty && !col.destination ? { ...col, skipped: true } : col,
  );
}

function cellAt(rows: string[][], r: number, c: number): string {
  if (c < 0) return "";
  return (rows[r]?.[c] ?? "").trim();
}

export function normalizeImportPriority(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim().toLowerCase();
  if (v === "high" || v === "a" || v === "tier 1" || v === "tier a" || v === "1") return "HIGH";
  if (v === "medium" || v === "b" || v === "tier 2" || v === "tier b" || v === "2") return "MEDIUM";
  if (v === "low" || v === "c" || v === "tier 3" || v === "tier c" || v === "3") return "LOW";
  const upper = value.trim().toUpperCase();
  if (upper === "HIGH" || upper === "MEDIUM" || upper === "LOW") return upper;
  return value.trim();
}

/** Title-case spreadsheet header for notes labels. */
export function titleCaseHeader(header: string): string {
  return header
    .trim()
    .split(/(\s+|\/)/)
    .map((part) => {
      if (!part.trim() || part === "/" || part === " ") return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

export function buildCompanyNotesFromRow(
  row: string[],
  headers: string[],
  mappedCompanyCol: number,
  mappedPriorityCol: number | null,
  opts?: {
    includeUnmappedInNotes?: boolean;
    skippedColumnIndexes?: Iterable<number>;
    category?: string | null;
  },
): string | null {
  if (opts?.includeUnmappedInNotes === false) return opts.category ? `Category: ${opts.category}` : null;

  const skip = new Set(opts?.skippedColumnIndexes ?? []);
  const lines: string[] = [];
  if (opts?.category) lines.push(`Category: ${opts.category}`);

  for (let i = 0; i < headers.length; i++) {
    if (i === mappedCompanyCol) continue;
    if (mappedPriorityCol != null && i === mappedPriorityCol) continue;
    if (skip.has(i)) continue;

    const val = (row[i] ?? "").trim();
    if (!val) continue;

    const header = String(headers[i] ?? "").trim();
    if (!header) continue;

    lines.push(`${titleCaseHeader(header)}: ${val}`);
  }

  return lines.length ? lines.join("\n") : null;
}

function buildNotesForRow(
  rows: string[][],
  r: number,
  columns: CompaniesColumnMapping[],
  includeUnmappedInNotes: boolean,
  category: string | null,
): string | null {
  const companyCol = colForDestination(columns, "company");
  const priorityCol = colForDestination(columns, "priority");
  if (companyCol < 0) return null;

  const headers = columns.map((c) => c.header);
  const skipped = columns.filter((c) => c.skipped || c.isEmpty).map((c) => c.columnIndex);

  return buildCompanyNotesFromRow(rows[r] ?? [], headers, companyCol, priorityCol >= 0 ? priorityCol : null, {
    includeUnmappedInNotes,
    skippedColumnIndexes: skipped,
    category,
  });
}

export function buildCompaniesFromMapping(
  preview: CompaniesSheetPreview,
  columns: CompaniesColumnMapping[],
  opts?: { source?: string; includeUnmappedInNotes?: boolean },
): ImportRow<SuggestedTrackedCompany>[] {
  resetCompanyMappingIds();
  const { rows, headerRowIndex, rowCategories } = preview;
  const companyCol = colForDestination(columns, "company");
  if (companyCol < 0) return [];

  const priorityCol = colForDestination(columns, "priority");
  const source = opts?.source ?? preview.sheetName;
  const includeUnmapped = opts?.includeUnmappedInNotes ?? true;
  const out: ImportRow<SuggestedTrackedCompany>[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const company = cellAt(rows, r, companyCol);
    if (!company) continue;
    if (looksLikeSectionHeader(company)) continue;
    if (/^company$|^name$/i.test(company)) continue;

    const category = rowCategories?.[r] ?? null;
    const priorityRaw = priorityCol >= 0 ? cellAt(rows, r, priorityCol) : "";
    const notes = buildNotesForRow(rows, r, columns, includeUnmapped, category);

    out.push({
      id: nextCompanyId(),
      selected: true,
      source,
      data: {
        name: company,
        priority: normalizeImportPriority(priorityRaw),
        notes,
      },
    });
  }

  return dedupeImportCompanies(out);
}

function dedupeImportCompanies(rows: ImportRow<SuggestedTrackedCompany>[]): ImportRow<SuggestedTrackedCompany>[] {
  const byKey = new Map<string, ImportRow<SuggestedTrackedCompany>>();
  for (const row of rows) {
    const key = row.data.name.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, {
      ...existing,
      data: {
        ...existing.data,
        priority: existing.data.priority ?? row.data.priority,
        notes: [existing.data.notes, row.data.notes].filter(Boolean).join("\n\n") || null,
      },
    });
  }
  return [...byKey.values()];
}

export function buildCompaniesMappingRecommendation(
  columns: CompaniesColumnMapping[],
  companyCount: number,
): string {
  const companyCol = columns.find((c) => c.destination === "company");
  const priorityCol = columns.find((c) => c.destination === "priority");
  const notesCols = noteColumnsFromMapping(columns);

  const parts: string[] = [];
  parts.push(
    `Imported ${companyCount} companies: company name → watchlist${priorityCol ? ", priority → tier (HIGH/MEDIUM/LOW)" : ""}.`,
  );

  if (notesCols.length) {
    const labels = notesCols.map((c) => c.header).join(", ");
    parts.push(`Other columns (${labels}) were merged into each company's notes as one labeled line per field.`);
  }

  if (companyCol) {
    parts.unshift(
      `"${companyCol.header}" → Company${priorityCol ? `; "${priorityCol.header}" → Priority` : ""}.`,
    );
  }

  return parts.join(" ");
}

export function buildCompaniesImportPreview(
  sheetPreview: CompaniesSheetPreview,
  columns: CompaniesColumnMapping[],
  includeUnmappedInNotes = true,
): { companies: ImportRow<SuggestedTrackedCompany>[]; warnings: string[]; mappingRecommendation: string } {
  const validation = validateCompaniesMapping(columns);
  if (validation) return { companies: [], warnings: [validation], mappingRecommendation: "" };

  const companies = buildCompaniesFromMapping(sheetPreview, columns, {
    source: sheetPreview.sheetName,
    includeUnmappedInNotes,
  });

  const warnings: string[] = [];
  if (!companies.length) {
    warnings.push("No company rows found with current mapping — check the Company column.");
  } else {
    warnings.push(`${companies.length} company(ies) ready to import.`);
  }

  const mappingRecommendation = buildCompaniesMappingRecommendation(columns, companies.length);
  return { companies, warnings, mappingRecommendation };
}

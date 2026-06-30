import * as XLSX from "xlsx";
import type { ImportContact, ImportRow } from "@/lib/client-import/types";
import { normJobHeader } from "@/lib/client-import/job-columns";
import { titleCaseHeader } from "@/lib/client-import/company-field-mapping";

export type ContactsDestinationFieldId =
  | "email"
  | "name"
  | "company"
  | "linkedinUrl"
  | "contacted"
  | "notes";

export type ContactsDestinationField = {
  id: ContactsDestinationFieldId;
  label: string;
  required: boolean;
  description?: string;
};

export const CONTACTS_DESTINATION_FIELDS: ContactsDestinationField[] = [
  { id: "email", label: "Email", required: true },
  { id: "name", label: "Contact name", required: false },
  { id: "company", label: "Company", required: false },
  { id: "linkedinUrl", label: "LinkedIn URL", required: false },
  { id: "contacted", label: "Contacted?", required: false, description: "Yes / No" },
  { id: "notes", label: "Notes", required: false },
];

export type ContactsColumnMapping = {
  columnIndex: number;
  header: string;
  skipped: boolean;
  destination: ContactsDestinationFieldId | null;
  sampleValues: string[];
  isEmpty: boolean;
};

export type ContactsSheetPreview = {
  filename: string;
  sheetName: string;
  headerRowIndex: number;
  columns: ContactsColumnMapping[];
  dataRowCount: number;
  rows: string[][];
};

export type ContactImportOptions = {
  /** When true, unmapped columns are appended to notes as labeled lines. */
  includeUnmappedInNotes: boolean;
};

export const DEFAULT_CONTACT_IMPORT_OPTIONS: ContactImportOptions = {
  includeUnmappedInNotes: true,
};

const HEADER_PATTERNS: Record<ContactsDestinationFieldId, RegExp[]> = {
  email: [/e-?mail/, /email address/],
  name: [/contact name/, /^name$/, /full name/],
  company: [/^company$/, /company name/, /employer/],
  linkedinUrl: [/linkedin url/, /linkedin profile/, /^linkedin$/],
  contacted: [/^contacted/, /contacted\?/],
  notes: [/^notes$/, /comments/, /remarks/],
};

const SINGLE_USE_DESTINATIONS = new Set<ContactsDestinationFieldId>([
  "email",
  "name",
  "company",
  "linkedinUrl",
  "contacted",
  "notes",
]);

let rowCounter = 0;
function nextContactId(): string {
  rowCounter += 1;
  return `contact_${rowCounter}`;
}

export function resetContactMappingIds(): void {
  rowCounter = 0;
}

function normHeader(value: unknown): string {
  return normJobHeader(value);
}

function scoreContactsHeaderRow(row: unknown[]): number {
  const joined = row.map((c) => normHeader(c)).join(" ");
  let score = 0;
  if (/\bemail\b/.test(joined)) score += 4;
  if (/contact name|^name\b/.test(joined)) score += 2;
  if (/\bcompany\b/.test(joined)) score += 2;
  if (/contacted|linkedin|notes|gmail|date/.test(joined)) score += 1;
  return score;
}

function findBestHeaderRow(rows: unknown[][], minScore = 3): number {
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const score = scoreContactsHeaderRow(rows[i] ?? []);
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
    if (val) samples.push(val);
  }
  return samples;
}

export function suggestContactsMappings(headers: unknown[]): Map<number, ContactsDestinationFieldId> {
  const mapping = new Map<number, ContactsDestinationFieldId>();
  const used = new Set<ContactsDestinationFieldId>();

  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i]);
    if (!h) continue;
    for (const field of CONTACTS_DESTINATION_FIELDS) {
      if (used.has(field.id)) continue;
      if (HEADER_PATTERNS[field.id].some((p) => p.test(h))) {
        mapping.set(i, field.id);
        if (SINGLE_USE_DESTINATIONS.has(field.id)) used.add(field.id);
        break;
      }
    }
  }

  // "LinkedIn connections" is outreach status, not a profile URL — leave unmapped for notes.
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i]);
    if (/linkedin connections?/.test(h)) {
      mapping.delete(i);
    }
  }

  return mapping;
}

function buildColumnMappings(rows: string[][], headerIdx: number): ContactsColumnMapping[] {
  const headers = rows[headerIdx] ?? [];
  const suggestions = suggestContactsMappings(headers);
  const maxCol = Math.max(headers.length, ...rows.slice(headerIdx + 1, headerIdx + 8).map((r) => r.length));
  const columns: ContactsColumnMapping[] = [];

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

export function parseContactsSheetFromWorkbook(buffer: Buffer, filename: string): ContactsSheetPreview {
  const wb = XLSX.read(buffer, { type: "buffer", cellStyles: false });
  const sheetName =
    findSheet(wb, [/contact list/, /^contacts$/, /outreach/, /network/]) ??
    findSheet(wb, [/contact/]) ??
    wb.SheetNames[0] ??
    "Sheet1";

  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("No worksheet found in file.");

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
  const rows = rowsToStringGrid(raw);
  const headerRowIndex = findBestHeaderRow(raw);
  if (headerRowIndex < 0) throw new Error("Could not detect a header row — include an Email column.");

  const columns = buildColumnMappings(rows, headerRowIndex);

  return {
    filename,
    sheetName,
    headerRowIndex,
    columns,
    dataRowCount: countDataRows(rows, headerRowIndex),
    rows,
  };
}

export function parseContactsSheetFromText(text: string, filename: string): ContactsSheetPreview {
  const raw = splitPasteLines(text);
  if (!raw.length) throw new Error("No rows found in pasted text.");
  const rows = rowsToStringGrid(raw);
  const headerRowIndex = findBestHeaderRow(raw, 2);
  if (headerRowIndex < 0) throw new Error("Could not detect a header row — include an Email column.");

  const columns = buildColumnMappings(rows, headerRowIndex);

  return {
    filename: filename || "pasted-rows.txt",
    sheetName: "Pasted rows",
    headerRowIndex,
    columns,
    dataRowCount: countDataRows(rows, headerRowIndex),
    rows,
  };
}

export function colForDestination(columns: ContactsColumnMapping[], field: ContactsDestinationFieldId): number {
  const match = columns.find((c) => !c.skipped && c.destination === field);
  return match?.columnIndex ?? -1;
}

export function noteColumnsFromMapping(columns: ContactsColumnMapping[]): ContactsColumnMapping[] {
  const mapped = new Set(
    CONTACTS_DESTINATION_FIELDS.map((f) => colForDestination(columns, f.id)).filter((c) => c >= 0),
  );
  return columns.filter((c) => !c.skipped && !c.isEmpty && !mapped.has(c.columnIndex));
}

export function applyContactsFieldSelection(
  columns: ContactsColumnMapping[],
  selections: Partial<Record<ContactsDestinationFieldId, number | null>>,
): ContactsColumnMapping[] {
  return columns.map((col) => {
    let destination: ContactsDestinationFieldId | null = null;
    for (const field of CONTACTS_DESTINATION_FIELDS) {
      const selectedCol = selections[field.id];
      if (selectedCol != null && col.columnIndex === selectedCol) {
        destination = field.id;
        break;
      }
    }
    return { ...col, destination, skipped: destination ? false : col.skipped };
  });
}

export function countMappedColumns(columns: ContactsColumnMapping[]): {
  emailMapped: boolean;
  nameMapped: boolean;
  companyMapped: boolean;
  notesColumnCount: number;
} {
  return {
    emailMapped: colForDestination(columns, "email") >= 0,
    nameMapped: colForDestination(columns, "name") >= 0,
    companyMapped: colForDestination(columns, "company") >= 0,
    notesColumnCount: noteColumnsFromMapping(columns).length,
  };
}

export function validateContactsMapping(columns: ContactsColumnMapping[]): string | null {
  const active = columns.filter((c) => !c.skipped && !c.isEmpty && c.destination);
  const emailCols = active.filter((c) => c.destination === "email");
  if (emailCols.length === 0) return "Map an Email column to continue.";
  if (emailCols.length > 1) return "Only one column can map to Email.";

  for (const field of CONTACTS_DESTINATION_FIELDS) {
    if (field.id === "email") continue;
    const cols = active.filter((c) => c.destination === field.id);
    if (cols.length > 1) {
      const label = CONTACTS_DESTINATION_FIELDS.find((f) => f.id === field.id)?.label ?? field.id;
      return `Only one column can map to ${label}.`;
    }
  }

  return null;
}

function cellAt(rows: string[][], r: number, c: number): string {
  if (c < 0) return "";
  return (rows[r]?.[c] ?? "").trim();
}

export function parseImportContacted(raw: string | null | undefined): boolean | null {
  if (!raw?.trim()) return null;
  const v = raw.trim().toLowerCase();
  if (v === "yes" || v === "y" || v === "true" || v === "1") return true;
  if (v === "no" || v === "n" || v === "false" || v === "0") return false;
  return null;
}

function extractLinkedinUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.includes("linkedin.com")) return trimmed;
  return null;
}

export function buildContactNotesFromRow(
  row: string[],
  headers: string[],
  mappedCols: Record<ContactsDestinationFieldId, number>,
  opts?: {
    includeUnmappedInNotes?: boolean;
    skippedColumnIndexes?: Iterable<number>;
    explicitNotes?: string | null;
  },
): string | null {
  const lines: string[] = [];
  if (opts?.explicitNotes?.trim()) lines.push(opts.explicitNotes.trim());

  if (opts?.includeUnmappedInNotes === false) {
    return lines.length ? lines.join("\n") : null;
  }

  const skip = new Set(opts?.skippedColumnIndexes ?? []);
  const mappedIndexes = new Set(Object.values(mappedCols).filter((c) => c >= 0));

  for (let i = 0; i < headers.length; i++) {
    if (mappedIndexes.has(i)) continue;
    if (skip.has(i)) continue;

    const val = (row[i] ?? "").trim();
    if (!val) continue;

    const header = String(headers[i] ?? "").trim();
    if (!header) continue;

    lines.push(`${titleCaseHeader(header)}: ${val}`);
  }

  return lines.length ? lines.join("\n") : null;
}

function buildContactFromRow(
  rows: string[][],
  r: number,
  columns: ContactsColumnMapping[],
  includeUnmappedInNotes: boolean,
): ImportContact | null {
  const emailCol = colForDestination(columns, "email");
  if (emailCol < 0) return null;

  const email = cellAt(rows, r, emailCol).toLowerCase();
  if (!email.includes("@")) return null;

  const nameCol = colForDestination(columns, "name");
  const companyCol = colForDestination(columns, "company");
  const linkedinCol = colForDestination(columns, "linkedinUrl");
  const contactedCol = colForDestination(columns, "contacted");
  const notesCol = colForDestination(columns, "notes");

  const mappedCols: Record<ContactsDestinationFieldId, number> = {
    email: emailCol,
    name: nameCol,
    company: companyCol,
    linkedinUrl: linkedinCol,
    contacted: contactedCol,
    notes: notesCol,
  };

  const name = nameCol >= 0 ? cellAt(rows, r, nameCol) || null : null;
  const company = companyCol >= 0 ? cellAt(rows, r, companyCol) || null : null;
  const contactedRaw = contactedCol >= 0 ? cellAt(rows, r, contactedCol) : "";
  const explicitNotes = notesCol >= 0 ? cellAt(rows, r, notesCol) || null : null;

  let linkedinUrl =
    linkedinCol >= 0 ? extractLinkedinUrl(cellAt(rows, r, linkedinCol)) : null;
  if (!linkedinUrl && explicitNotes) {
    linkedinUrl = extractLinkedinUrl(explicitNotes);
  }

  const headers = columns.map((c) => c.header);
  const skipped = columns.filter((c) => c.skipped || c.isEmpty).map((c) => c.columnIndex);
  const notesBody = buildContactNotesFromRow(rows[r] ?? [], headers, mappedCols, {
    includeUnmappedInNotes,
    skippedColumnIndexes: skipped,
    explicitNotes: linkedinUrl && explicitNotes === linkedinUrl ? null : explicitNotes,
  });

  return {
    email,
    name,
    company,
    linkedinUrl,
    notes: notesBody,
    contacted: parseImportContacted(contactedRaw),
  };
}

export function buildContactsFromMapping(
  preview: ContactsSheetPreview,
  columns: ContactsColumnMapping[],
  opts?: { source?: string; includeUnmappedInNotes?: boolean },
): ImportRow<ImportContact>[] {
  resetContactMappingIds();
  const { rows, headerRowIndex } = preview;
  const source = opts?.source ?? preview.sheetName;
  const includeUnmapped = opts?.includeUnmappedInNotes ?? true;
  const out: ImportRow<ImportContact>[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const contact = buildContactFromRow(rows, r, columns, includeUnmapped);
    if (!contact) continue;

    out.push({
      id: nextContactId(),
      selected: true,
      source,
      data: contact,
    });
  }

  return dedupeImportContacts(out);
}

function dedupeImportContacts(rows: ImportRow<ImportContact>[]): ImportRow<ImportContact>[] {
  const byEmail = new Map<string, ImportRow<ImportContact>>();
  for (const row of rows) {
    const key = row.data.email.toLowerCase();
    const existing = byEmail.get(key);
    if (!existing) {
      byEmail.set(key, row);
      continue;
    }
    byEmail.set(key, {
      ...existing,
      data: {
        email: existing.data.email,
        name: existing.data.name ?? row.data.name,
        company: existing.data.company ?? row.data.company,
        linkedinUrl: existing.data.linkedinUrl ?? row.data.linkedinUrl,
        contacted: existing.data.contacted ?? row.data.contacted,
        notes: [existing.data.notes, row.data.notes].filter(Boolean).join("\n\n") || null,
      },
    });
  }
  return [...byEmail.values()];
}

export function buildContactsMappingRecommendation(
  columns: ContactsColumnMapping[],
  contactCount: number,
): string {
  const parts: string[] = [];
  const mappedLabels: string[] = [];

  for (const field of CONTACTS_DESTINATION_FIELDS) {
    const col = columns.find((c) => c.destination === field.id);
    if (col) mappedLabels.push(`"${col.header}" → ${field.label}`);
  }

  if (mappedLabels.length) parts.push(mappedLabels.join("; ") + ".");

  const notesCols = noteColumnsFromMapping(columns);
  if (notesCols.length) {
    const labels = notesCols.map((c) => c.header).join(", ");
    parts.push(`Other columns (${labels}) were merged into each contact's notes as one labeled line per field.`);
  }

  parts.push(`Imported ${contactCount} contact(s) into inbox CRM (linked by company name to your watchlist).`);
  return parts.join(" ");
}

export function buildContactsImportPreview(
  sheetPreview: ContactsSheetPreview,
  columns: ContactsColumnMapping[],
  includeUnmappedInNotes = true,
): { contacts: ImportRow<ImportContact>[]; warnings: string[]; mappingRecommendation: string } {
  const validation = validateContactsMapping(columns);
  if (validation) return { contacts: [], warnings: [validation], mappingRecommendation: "" };

  const contacts = buildContactsFromMapping(sheetPreview, columns, {
    source: sheetPreview.sheetName,
    includeUnmappedInNotes,
  });

  const warnings: string[] = [];
  if (!contacts.length) {
    warnings.push("No contact rows found with current mapping — check the Email column.");
  } else {
    warnings.push(`${contacts.length} contact(s) ready to import.`);
  }

  const mappingRecommendation = buildContactsMappingRecommendation(columns, contacts.length);
  return { contacts, warnings, mappingRecommendation };
}

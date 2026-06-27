import * as XLSX from "xlsx";
import type { JobStage } from "@prisma/client";
import type { ClientImportPreview, ImportContact, ImportPipelineJob, ImportRow } from "@/lib/client-import/types";
import type { SuggestedTrackedCompany } from "@/lib/intake-tracked-companies";

let rowCounter = 0;
function nextId(prefix: string): string {
  rowCounter += 1;
  return `${prefix}_${rowCounter}`;
}

function resetIds() {
  rowCounter = 0;
}

function normHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell) return "";
  if (cell.w) return String(cell.w).trim();
  if (cell.v == null) return "";
  return String(cell.v).trim();
}

function isStruck(cell: XLSX.CellObject | undefined): boolean {
  if (!cell?.s || typeof cell.s !== "object") return false;
  const font = (cell.s as { font?: { strike?: boolean } }).font;
  return Boolean(font?.strike);
}

function sheetRows(wb: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
}

function findSheet(wb: XLSX.WorkBook, patterns: RegExp[]): string | null {
  for (const name of wb.SheetNames) {
    const lower = name.toLowerCase();
    if (patterns.some((p) => p.test(lower))) return name;
  }
  return null;
}

function findHeaderRow(rows: unknown[][], matchers: RegExp[]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const joined = (rows[i] ?? []).map((c) => normHeader(c)).join(" ");
    if (matchers.some((re) => re.test(joined))) return i;
  }
  return -1;
}

function colIndex(headers: unknown[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i]);
    if (patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

function mapApplicationStatus(raw: string): JobStage {
  const v = raw.trim().toLowerCase();
  if (!v || v === "pending") return "APPLIED";
  if (v.includes("reject")) return "REJECTED";
  if (v.includes("offer")) return "OFFER";
  if (v.includes("interview")) return "INTERVIEWING";
  if (v.includes("screen")) return "SCREENING";
  if (v.includes("applied")) return "APPLIED";
  if (v.includes("withdraw")) return "WITHDRAWN";
  return "APPLIED";
}

function parseJobTrackerSheet(wb: XLSX.WorkBook, sheetName: string): ImportRow<ImportPipelineJob>[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const rows = sheetRows(wb, sheetName);
  const headerIdx = findHeaderRow(rows, [/company/, /job title/, /application status/]);
  if (headerIdx < 0) return [];

  const headers = rows[headerIdx] ?? [];
  const companyCol = colIndex(headers, [/^company/, /company name/]);
  const roleCol = colIndex(headers, [/job title/, /^role/, /^title/]);
  const urlCol = colIndex(headers, [/^url/, /job description link/, /posting/]);
  const statusCol = colIndex(headers, [/application status/, /^status/]);
  const notesCol = colIndex(headers, [/^notes/]);
  const dateCol = colIndex(headers, [/application date/, /^date applied/, /^date/]);

  if (companyCol < 0 || roleCol < 0) return [];

  const out: ImportRow<ImportPipelineJob>[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const company = String(row[companyCol] ?? "").trim();
    const role = String(row[roleCol] ?? "").trim();
    if (!company || !role) continue;
    if (/^company|^job title/i.test(company)) continue;

    const statusRaw = statusCol >= 0 ? String(row[statusCol] ?? "").trim() : "Applied";
    const url = urlCol >= 0 ? String(row[urlCol] ?? "").trim() || null : null;
    const notes = notesCol >= 0 ? String(row[notesCol] ?? "").trim() || null : null;
    const appliedAtRaw = dateCol >= 0 ? String(row[dateCol] ?? "").trim() : "";

    out.push({
      id: nextId("job"),
      selected: true,
      source: sheetName,
      data: {
        company,
        role,
        url: url && /^https?:\/\//i.test(url) ? url : null,
        stage: mapApplicationStatus(statusRaw),
        notes,
        appliedAt: appliedAtRaw || null,
      },
    });
  }
  return out;
}

function parseContactListSheet(wb: XLSX.WorkBook, sheetName: string): ImportRow<ImportContact>[] {
  const rows = sheetRows(wb, sheetName);
  const headerIdx = findHeaderRow(rows, [/contact name/, /company/, /email/]);
  if (headerIdx < 0) return [];

  const headers = rows[headerIdx] ?? [];
  const companyCol = colIndex(headers, [/^company/]);
  const nameCol = colIndex(headers, [/contact name/, /^name/]);
  const emailCol = colIndex(headers, [/email/]);
  const contactedCol = colIndex(headers, [/contacted/]);
  const notesCol = colIndex(headers, [/^notes/]);
  const linkedinCol = headers.findIndex((h) => normHeader(h).includes("linkedin"));

  if (emailCol < 0 && nameCol < 0) return [];

  const out: ImportRow<ImportContact>[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const email = emailCol >= 0 ? String(row[emailCol] ?? "").trim().toLowerCase() : "";
    const name = nameCol >= 0 ? String(row[nameCol] ?? "").trim() : "";
    const company = companyCol >= 0 ? String(row[companyCol] ?? "").trim() : "";
    if (!email || !email.includes("@")) continue;

    const linkedinRaw = linkedinCol >= 0 ? String(row[linkedinCol] ?? "").trim() : "";
    const contactedRaw = contactedCol >= 0 ? String(row[contactedCol] ?? "").trim().toLowerCase() : "";
    const notes = notesCol >= 0 ? String(row[notesCol] ?? "").trim() || null : null;

    out.push({
      id: nextId("contact"),
      selected: true,
      source: sheetName,
      data: {
        email,
        name: name || null,
        company: company || null,
        linkedinUrl: linkedinRaw && linkedinRaw.includes("linkedin.com") ? linkedinRaw : null,
        notes,
        contacted: contactedRaw ? contactedRaw === "yes" || contactedRaw === "true" || contactedRaw === "y" : null,
      },
    });
  }
  return out;
}

function parseTargetCompaniesSheet(wb: XLSX.WorkBook, sheetName: string): ImportRow<SuggestedTrackedCompany>[] {
  const rows = sheetRows(wb, sheetName);
  const out: ImportRow<SuggestedTrackedCompany>[] = [];
  let started = false;

  for (const row of rows) {
    const cells = (row ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
    if (!cells.length) continue;
    const first = cells[0]!;
    const lower = first.toLowerCase();
    if (!started) {
      if (/target companies/i.test(lower)) {
        started = true;
      }
      continue;
    }
    if (/^company|^name|^target/i.test(lower)) continue;
    out.push({
      id: nextId("co"),
      selected: true,
      source: sheetName,
      data: { name: first, priority: "HIGH" },
    });
  }
  return out;
}

function parseTargetJobTitlesSheet(wb: XLSX.WorkBook, sheetName: string): {
  targetRoles: ImportRow<string>[];
  deprioritizedRoles: ImportRow<string>[];
  avoidNotes: string | null;
} {
  const sheet = wb.Sheets[sheetName];
  const rows = sheetRows(wb, sheetName);
  const targetRoles: ImportRow<string>[] = [];
  const deprioritizedRoles: ImportRow<string>[] = [];
  const noteLines: string[] = [];
  let inCorporate = false;
  let inConsulting = false;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const joined = row.map((c) => cellText(sheet[XLSX.utils.encode_cell({ r, c: 0 })])).join(" ").trim();
    const col0 = cellText(sheet[XLSX.utils.encode_cell({ r, c: 0 })]);
    const col1 = cellText(sheet[XLSX.utils.encode_cell({ r, c: 1 })]);

    if (/corporate job titles/i.test(col0)) {
      inCorporate = true;
      inConsulting = false;
      continue;
    }
    if (/consult/i.test(col0) && /job titles/i.test(col0)) {
      inConsulting = true;
      inCorporate = false;
      continue;
    }
    if (/target job titles/i.test(col0) && !col1) continue;

    for (let c = 0; c <= 1; c++) {
      const cellRef = sheet[XLSX.utils.encode_cell({ r, c })];
      const cell = sheet[cellRef];
      const text = cellText(cell);
      if (!text || text.length < 3) continue;
      if (/^(corporate|consult|target job)/i.test(text)) continue;
      if (text.length > 120 && text.includes(" ")) {
        noteLines.push(text);
        continue;
      }

      const struck = isStruck(cell);
      const rowData: ImportRow<string> = {
        id: nextId(struck ? "drole" : "role"),
        selected: true,
        source: sheetName,
        data: text,
      };
      if (struck) deprioritizedRoles.push(rowData);
      else if (inCorporate || inConsulting || c <= 1) targetRoles.push(rowData);
    }

    if (col1 && col1.length > 80) noteLines.push(col1);
    if (!col0 && !col1 && joined) noteLines.push(joined);
  }

  const dedupe = (items: ImportRow<string>[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.data.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    targetRoles: dedupe(targetRoles),
    deprioritizedRoles: dedupe(deprioritizedRoles),
    avoidNotes: noteLines.length ? noteLines.join("\n") : null,
  };
}

function parseWeeklyActivitySheet(wb: XLSX.WorkBook, sheetName: string): string | null {
  const rows = sheetRows(wb, sheetName);
  const headerIdx = findHeaderRow(rows, [/week/, /jobs applied/]);
  if (headerIdx < 0) return null;

  const headers = rows[headerIdx] ?? [];
  const weekCol = colIndex(headers, [/^week/]);
  const appliedCol = colIndex(headers, [/jobs applied/]);
  const addedCol = colIndex(headers, [/jobs added/]);

  const chunks: string[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const week = weekCol >= 0 ? String(row[weekCol] ?? "").trim() : "";
    const applied = appliedCol >= 0 ? String(row[appliedCol] ?? "").trim() : "";
    const added = addedCol >= 0 ? String(row[addedCol] ?? "").trim() : "";
    if (!week && !applied && !added) continue;
    chunks.push(`${week || "Week"}: ${added || "?"} added, ${applied || "?"} applied`);
  }
  return chunks.length ? chunks.join("; ") : null;
}

function dedupeCompanies(rows: ImportRow<SuggestedTrackedCompany>[]) {
  const byKey = new Map<string, ImportRow<SuggestedTrackedCompany>>();
  for (const row of rows) {
    const key = row.data.name.trim().toLowerCase();
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return [...byKey.values()];
}

function dedupeJobs(rows: ImportRow<ImportPipelineJob>[]) {
  const byKey = new Map<string, ImportRow<ImportPipelineJob>>();
  for (const row of rows) {
    const key = `${row.data.company.toLowerCase()}::${row.data.role.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return [...byKey.values()];
}

function dedupeContacts(rows: ImportRow<ImportContact>[]) {
  const byKey = new Map<string, ImportRow<ImportContact>>();
  for (const row of rows) {
    const key = row.data.email.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return [...byKey.values()];
}

export function parseClientImportWorkbook(buffer: Buffer, filename: string): ClientImportPreview {
  resetIds();
  const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true });
  const warnings: string[] = [];

  const jobSheet = findSheet(wb, [/job tracker/, /application tracker/]);
  const contactSheet = findSheet(wb, [/contact list/, /contacts/]);
  const companiesSheet = findSheet(wb, [/target companies/]);
  const titlesSheet = findSheet(wb, [/target job titles/, /job titles/]);
  const weeklySheet = findSheet(wb, [/weekly activity/]);

  const pipelineJobs = jobSheet ? parseJobTrackerSheet(wb, jobSheet) : [];
  const contacts = contactSheet ? parseContactListSheet(wb, contactSheet) : [];
  const companiesFromSheet = companiesSheet ? parseTargetCompaniesSheet(wb, companiesSheet) : [];
  const titles = titlesSheet ? parseTargetJobTitlesSheet(wb, titlesSheet) : { targetRoles: [], deprioritizedRoles: [], avoidNotes: null };
  const searchDuration = weeklySheet ? parseWeeklyActivitySheet(wb, weeklySheet) : null;

  if (!jobSheet) warnings.push("No Job Tracker tab found — pipeline jobs skipped.");
  if (!contactSheet) warnings.push("No Contact List tab found.");
  if (!companiesSheet) warnings.push("No Target Companies tab found.");
  if (!titlesSheet) warnings.push("No Target Job Titles tab found.");

  const companiesFromJobs: ImportRow<SuggestedTrackedCompany>[] = pipelineJobs.map((job) => ({
    id: nextId("co"),
    selected: false,
    source: "Job Tracker (derived)",
    data: { name: job.data.company, priority: "MEDIUM", notes: "From job tracker import" },
  }));

  const allCompanies = dedupeCompanies([...companiesFromSheet, ...companiesFromJobs]);

  return {
    sourceFiles: [{ filename, kind: "xlsx" }],
    profile: {
      targetRoles: titles.targetRoles,
      deprioritizedRoles: titles.deprioritizedRoles,
      searchDuration,
      avoidNotes: titles.avoidNotes,
      proposed: {},
    },
    pipelineJobs: dedupeJobs(pipelineJobs),
    companies: allCompanies,
    contacts: dedupeContacts(contacts),
    referenceDocuments: [],
    warnings,
  };
}

export function mergeImportPreviews(base: ClientImportPreview, extra: ClientImportPreview): ClientImportPreview {
  return {
    sourceFiles: [...base.sourceFiles, ...extra.sourceFiles],
    profile: {
      targetRoles: [...base.profile.targetRoles, ...extra.profile.targetRoles],
      deprioritizedRoles: [...base.profile.deprioritizedRoles, ...extra.profile.deprioritizedRoles],
      searchDuration: extra.profile.searchDuration || base.profile.searchDuration,
      avoidNotes: [base.profile.avoidNotes, extra.profile.avoidNotes].filter(Boolean).join("\n") || null,
      proposed: { ...base.profile.proposed, ...extra.profile.proposed },
    },
    pipelineJobs: dedupeJobs([...base.pipelineJobs, ...extra.pipelineJobs]),
    companies: dedupeCompanies([...base.companies, ...extra.companies]),
    contacts: dedupeContacts([...base.contacts, ...extra.contacts]),
    referenceDocuments: [...base.referenceDocuments, ...extra.referenceDocuments],
    warnings: [...base.warnings, ...extra.warnings],
  };
}

export function emptyImportPreview(): ClientImportPreview {
  return {
    sourceFiles: [],
    profile: {
      targetRoles: [],
      deprioritizedRoles: [],
      searchDuration: null,
      avoidNotes: null,
      proposed: {},
    },
    pipelineJobs: [],
    companies: [],
    contacts: [],
    referenceDocuments: [],
    resume: null,
    warnings: [],
  };
}

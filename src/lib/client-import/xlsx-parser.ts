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
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCellDisplay(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const ref = XLSX.utils.encode_cell({ r, c });
  const cell = sheet[ref] as XLSX.CellObject | undefined;
  if (!cell) return "";
  if (cell.w) return String(cell.w).trim();
  if (cell.v == null) return "";
  return String(cell.v).trim();
}

function isStruck(sheet: XLSX.WorkSheet, r: number, c: number): boolean {
  const ref = XLSX.utils.encode_cell({ r, c });
  const cell = sheet[ref] as XLSX.CellObject | undefined;
  if (!cell?.s || typeof cell.s !== "object") return false;
  const font = (cell.s as { font?: { strike?: boolean } }).font;
  return Boolean(font?.strike);
}

function sheetRows(wb: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }) as unknown[][];
}

function findSheet(wb: XLSX.WorkBook, patterns: RegExp[]): string | null {
  for (const name of wb.SheetNames) {
    const lower = name.trim().toLowerCase();
    if (patterns.some((p) => p.test(lower))) return name;
  }
  return null;
}

function colIndex(headers: unknown[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i]);
    if (!h) continue;
    if (patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

function scoreHeaderRow(row: unknown[]): number {
  const joined = row.map((c) => normHeader(c)).join(" ");
  let score = 0;
  if (/company/.test(joined)) score += 2;
  if (/job title|^title|role/.test(joined)) score += 2;
  if (/application status|app status/.test(joined)) score += 2;
  if (/\burl\b|job description|posting link/.test(joined)) score += 1;
  if (/application date|date applied/.test(joined)) score += 1;
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
  return bestScore >= minScore ? bestIdx : -1;
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

function cleanCompanyName(raw: string, jobUrl: string | null): string {
  const text = raw.trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) {
    if (jobUrl && !/^https?:\/\//i.test(jobUrl)) {
      /* keep */
    }
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

function parseJobTableFromSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  opts?: { inferInterviewStage?: boolean },
): ImportRow<ImportPipelineJob>[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];

  const rows = sheetRows(wb, sheetName);
  const headerIdx = findBestHeaderRow(rows);
  if (headerIdx < 0) return [];

  const headers = rows[headerIdx] ?? [];
  const companyCol = colIndex(headers, [/company name/, /^company/, /employer/]);
  const roleCol = colIndex(headers, [/job title/, /^title$/, /^role$/, /position/]);
  const urlCol = colIndex(headers, [/^url$/, /job description link/, /posting link/, /careers link/]);
  const statusCol = colIndex(headers, [/application status/, /app status/]);
  const fallbackStatusCol =
    statusCol >= 0
      ? statusCol
      : colIndex(headers, [/^status$/, /stage/]);
  const notesCol = colIndex(headers, [/^notes/]);
  const dateCol = colIndex(headers, [/application date/, /date applied/]);

  if (companyCol < 0 || roleCol < 0) return [];

  const out: ImportRow<ImportPipelineJob>[] = [];

  for (let r = headerIdx + 1; r < rows.length; r++) {
    let company = getCellDisplay(sheet, r, companyCol);
    let role = getCellDisplay(sheet, r, roleCol);
    if (!company && !role) continue;

    const urlRaw = urlCol >= 0 ? getCellDisplay(sheet, r, urlCol) : "";
    const url = urlRaw && /^https?:\/\//i.test(urlRaw) ? urlRaw : null;

    company = cleanCompanyName(company, url);
    role = role.trim();
    if (!company || !role) continue;
    if (/^company|^job title|^title$/i.test(company)) continue;

    const statusRaw =
      fallbackStatusCol >= 0 ? getCellDisplay(sheet, r, fallbackStatusCol) : "Applied";
    const notes = notesCol >= 0 ? getCellDisplay(sheet, r, notesCol) || null : null;
    const appliedAtRaw = dateCol >= 0 ? getCellDisplay(sheet, r, dateCol) : "";

    let stage = mapApplicationStatus(statusRaw);
    if (opts?.inferInterviewStage && /interview tracker/i.test(sheetName)) {
      const roundCols = [
        /phone screen/,
        /first interview/,
        /second interview/,
        /third interview/,
        /assessment/,
        /offer/,
      ];
      for (let c = 0; c < headers.length; c++) {
        const h = normHeader(headers[c]);
        const val = getCellDisplay(sheet, r, c);
        if (!val) continue;
        if (roundCols[4]!.test(h) && val) stage = "OFFER";
        else if (roundCols[3]!.test(h) && val) stage = "INTERVIEWING";
        else if (roundCols[2]!.test(h) && val) stage = "INTERVIEWING";
        else if (roundCols[1]!.test(h) && val) stage = "INTERVIEWING";
        else if (roundCols[0]!.test(h) && val) stage = "SCREENING";
      }
    }

    out.push({
      id: nextId("job"),
      selected: true,
      source: sheetName,
      data: {
        company,
        role,
        url,
        stage,
        notes,
        appliedAt: appliedAtRaw || null,
      },
    });
  }

  return out;
}

function collectJobsFromWorkbook(wb: XLSX.WorkBook): ImportRow<ImportPipelineJob>[] {
  const prioritySheets = [
    findSheet(wb, [/job tracker/, /application tracker/, /applications/]),
    findSheet(wb, [/interview tracker/]),
  ].filter(Boolean) as string[];

  const tried = new Set<string>();
  const all: ImportRow<ImportPipelineJob>[] = [];

  for (const name of prioritySheets) {
    tried.add(name);
    all.push(
      ...parseJobTableFromSheet(wb, name, {
        inferInterviewStage: /interview/i.test(name),
      }),
    );
  }

  for (const name of wb.SheetNames) {
    if (tried.has(name)) continue;
    if (/contact|weekly|target job|target compan|key word|keyword|readme/i.test(name)) continue;
    const parsed = parseJobTableFromSheet(wb, name);
    if (parsed.length) all.push(...parsed);
  }

  return dedupeJobs(all);
}

function parseContactListSheet(wb: XLSX.WorkBook, sheetName: string): ImportRow<ImportContact>[] {
  const rows = sheetRows(wb, sheetName);
  const headerIdx = findBestHeaderRow(rows, 3);
  if (headerIdx < 0) return [];

  const headers = rows[headerIdx] ?? [];
  const companyCol = colIndex(headers, [/^company/, /company name/]);
  const nameCol = colIndex(headers, [/contact name/, /^name$/]);
  const emailCol = colIndex(headers, [/email/]);
  const contactedCol = colIndex(headers, [/contacted/]);
  const notesCol = colIndex(headers, [/^notes/]);
  const linkedinCol = headers.findIndex((h) => normHeader(h).includes("linkedin"));

  if (emailCol < 0) return [];

  const sheet = wb.Sheets[sheetName]!;
  const out: ImportRow<ImportContact>[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const email = getCellDisplay(sheet, r, emailCol).toLowerCase();
    const name = nameCol >= 0 ? getCellDisplay(sheet, r, nameCol) : "";
    const company = companyCol >= 0 ? getCellDisplay(sheet, r, companyCol) : "";
    if (!email || !email.includes("@")) continue;

    const linkedinRaw = linkedinCol >= 0 ? getCellDisplay(sheet, r, linkedinCol) : "";
    const contactedRaw = contactedCol >= 0 ? getCellDisplay(sheet, r, contactedCol).toLowerCase() : "";
    const notes = notesCol >= 0 ? getCellDisplay(sheet, r, notesCol) || null : null;

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
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const rows = sheetRows(wb, sheetName);
  const out: ImportRow<SuggestedTrackedCompany>[] = [];
  let started = false;

  for (let r = 0; r < rows.length; r++) {
    const name = getCellDisplay(sheet, r, 0);
    if (!name) continue;
    const lower = name.toLowerCase();
    if (!started) {
      if (/target companies/i.test(lower)) started = true;
      continue;
    }
    if (/^company|^name|^target/i.test(lower)) continue;
    out.push({
      id: nextId("co"),
      selected: true,
      source: sheetName,
      data: { name, priority: "HIGH" },
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
    const col0 = getCellDisplay(sheet, r, 0);
    const col1 = getCellDisplay(sheet, r, 1);

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
      const text = getCellDisplay(sheet, r, c);
      if (!text || text.length < 3) continue;
      if (/^(corporate|consult|target job)/i.test(text)) continue;
      if (text.length > 120 && text.includes(" ")) {
        noteLines.push(text);
        continue;
      }

      const struck = isStruck(sheet, r, c);
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
  const sheet = wb.Sheets[sheetName]!;
  const rows = sheetRows(wb, sheetName);
  const headerIdx = findBestHeaderRow(rows, 2);
  if (headerIdx < 0) return null;

  const headers = rows[headerIdx] ?? [];
  const weekCol = colIndex(headers, [/^week/]);
  const appliedCol = colIndex(headers, [/jobs applied/]);
  const addedCol = colIndex(headers, [/jobs added/]);

  const chunks: string[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const week = weekCol >= 0 ? getCellDisplay(sheet, r, weekCol) : "";
    const applied = appliedCol >= 0 ? getCellDisplay(sheet, r, appliedCol) : "";
    const added = addedCol >= 0 ? getCellDisplay(sheet, r, addedCol) : "";
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
    const existing = byKey.get(key);
    if (!existing || row.selected) byKey.set(key, { ...row, selected: existing?.selected || row.selected });
  }
  return [...byKey.values()];
}

function dedupeJobs(rows: ImportRow<ImportPipelineJob>[]) {
  const byKey = new Map<string, ImportRow<ImportPipelineJob>>();
  for (const row of rows) {
    const key = `${row.data.company.toLowerCase()}::${row.data.role.toLowerCase()}`;
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

function dedupeContacts(rows: ImportRow<ImportContact>[]) {
  const byKey = new Map<string, ImportRow<ImportContact>>();
  for (const row of rows) {
    const key = row.data.email.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return [...byKey.values()];
}

function companiesFromJobs(jobs: ImportRow<ImportPipelineJob>[]): ImportRow<SuggestedTrackedCompany>[] {
  const seen = new Set<string>();
  const out: ImportRow<SuggestedTrackedCompany>[] = [];
  for (const job of jobs) {
    const key = job.data.company.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: nextId("co"),
      selected: true,
      source: "Job Tracker",
      data: {
        name: job.data.company,
        priority: "MEDIUM",
        notes: "Imported from job tracker — company watchlist",
      },
    });
  }
  return out;
}

export function parseClientImportWorkbook(buffer: Buffer, filename: string): ClientImportPreview {
  resetIds();
  const wb = XLSX.read(buffer, { type: "buffer", cellStyles: true });
  const warnings: string[] = [];

  const contactSheet = findSheet(wb, [/contact list/, /^contacts$/]);
  const companiesSheet = findSheet(wb, [/target companies/]);
  const titlesSheet = findSheet(wb, [/target job titles/, /^job titles$/]);
  const weeklySheet = findSheet(wb, [/weekly activity/]);

  const pipelineJobs = collectJobsFromWorkbook(wb);
  const contacts = contactSheet ? parseContactListSheet(wb, contactSheet) : [];
  const companiesFromSheet = companiesSheet ? parseTargetCompaniesSheet(wb, companiesSheet) : [];
  const titles = titlesSheet
    ? parseTargetJobTitlesSheet(wb, titlesSheet)
    : { targetRoles: [], deprioritizedRoles: [], avoidNotes: null };
  const searchDuration = weeklySheet ? parseWeeklyActivitySheet(wb, weeklySheet) : null;

  if (!pipelineJobs.length) {
    warnings.push(
      `No pipeline jobs found in ${filename}. Expected a tab with Company + Job Title columns (e.g. Job Tracker). Found tabs: ${wb.SheetNames.join(", ")}`,
    );
  } else {
    warnings.push(`Found ${pipelineJobs.length} jobs across workbook tabs.`);
  }
  if (!contactSheet) warnings.push("No Contact List tab found.");
  if (!companiesSheet) warnings.push("No Target Companies tab found (companies from job tracker will still import).");
  if (!titlesSheet) warnings.push("No Target Job Titles tab found.");

  const allCompanies = dedupeCompanies([...companiesFromSheet, ...companiesFromJobs(pipelineJobs)]);

  return {
    sourceFiles: [{ filename, kind: "xlsx" }],
    profile: {
      targetRoles: titles.targetRoles,
      deprioritizedRoles: titles.deprioritizedRoles,
      searchDuration,
      avoidNotes: titles.avoidNotes,
      proposed: {},
    },
    pipelineJobs,
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
    companies: dedupeCompanies([...base.companies, ...extra.companies, ...companiesFromJobs(extra.pipelineJobs)]),
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

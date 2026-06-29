import type { JobStage } from "@prisma/client";
import type { ClientImportPreview, ImportContact, ImportPipelineJob, ImportRow } from "@/lib/client-import/types";
import type { ImportType } from "@/lib/client-import/import-types";
import { emptyImportPreview } from "@/lib/client-import/xlsx-parser";
import { parseRoleTitleList } from "@/lib/parse-role-title-list";
import type { SuggestedTrackedCompany } from "@/lib/intake-tracked-companies";

let rowCounter = 0;
function nextId(prefix: string): string {
  rowCounter += 1;
  return `${prefix}_${rowCounter}`;
}

function resetIds() {
  rowCounter = 0;
}

function normHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function splitLines(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n").filter(Boolean);
  return lines.map((line) => {
    if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
    if (line.includes(";") && !line.includes(",")) return line.split(";").map((c) => c.trim());
    return line.split(",").map((c) => c.trim());
  });
}

function findHeaderRow(rows: string[][]): { idx: number; headers: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const headers = rows[i] ?? [];
    const joined = headers.map(normHeader).join(" ");
    if (/company/.test(joined) && (/job title|title|role/.test(joined) || /email/.test(joined))) {
      return { idx: i, headers };
    }
    if (/email/.test(joined)) return { idx: i, headers };
  }
  return rows.length ? { idx: 0, headers: rows[0] ?? [] } : null;
}

function colIndex(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i] ?? "");
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
  return "APPLIED";
}

function parseJobsFromPaste(text: string, source: string, inferInterview: boolean): ImportRow<ImportPipelineJob>[] {
  const rows = splitLines(text);
  const headerInfo = findHeaderRow(rows);
  if (!headerInfo) return [];

  const { idx: headerIdx, headers } = headerInfo;
  const companyCol = colIndex(headers, [/company name/, /^company/, /employer/]);
  const roleCol = colIndex(headers, [/job title/, /^title$/, /^role$/, /position/]);
  const urlCol = colIndex(headers, [/^url$/, /job description link/, /posting link/]);
  const statusCol = colIndex(headers, [/application status/, /app status/, /^status$/, /stage/]);
  const notesCol = colIndex(headers, [/^notes/]);

  if (companyCol < 0 || roleCol < 0) return [];

  const out: ImportRow<ImportPipelineJob>[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const company = (row[companyCol] ?? "").trim();
    const role = (row[roleCol] ?? "").trim();
    if (!company || !role) continue;

    const urlRaw = urlCol >= 0 ? (row[urlCol] ?? "").trim() : "";
    const url = urlRaw && /^https?:\/\//i.test(urlRaw) ? urlRaw : null;
    const statusRaw = statusCol >= 0 ? (row[statusCol] ?? "").trim() : "Applied";
    const notes = notesCol >= 0 ? (row[notesCol] ?? "").trim() || null : null;

    let stage = mapApplicationStatus(statusRaw);
    if (inferInterview) {
      for (let c = 0; c < headers.length; c++) {
        const h = normHeader(headers[c] ?? "");
        const val = (row[c] ?? "").trim();
        if (!val) continue;
        if (/offer/.test(h)) stage = "OFFER";
        else if (/interview|assessment/.test(h)) stage = "INTERVIEWING";
        else if (/phone screen/.test(h)) stage = "SCREENING";
      }
    }

    out.push({
      id: nextId("job"),
      selected: true,
      source,
      data: { company, role, url, stage, notes, appliedAt: null },
    });
  }
  return out;
}

function parseContactsFromPaste(text: string): ImportRow<ImportContact>[] {
  const rows = splitLines(text);
  const headerInfo = findHeaderRow(rows);
  if (!headerInfo) return [];

  const { idx: headerIdx, headers } = headerInfo;
  const emailCol = colIndex(headers, [/email/]);
  const nameCol = colIndex(headers, [/contact name/, /^name$/]);
  const companyCol = colIndex(headers, [/^company/, /company name/]);
  const notesCol = colIndex(headers, [/^notes/]);
  const linkedinCol = headers.findIndex((h) => normHeader(h).includes("linkedin"));

  if (emailCol < 0) return [];

  const out: ImportRow<ImportContact>[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const email = (row[emailCol] ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    const linkedinRaw = linkedinCol >= 0 ? (row[linkedinCol] ?? "").trim() : "";
    out.push({
      id: nextId("contact"),
      selected: true,
      source: "paste",
      data: {
        email,
        name: nameCol >= 0 ? (row[nameCol] ?? "").trim() || null : null,
        company: companyCol >= 0 ? (row[companyCol] ?? "").trim() || null : null,
        linkedinUrl: linkedinRaw.includes("linkedin.com") ? linkedinRaw : null,
        notes: notesCol >= 0 ? (row[notesCol] ?? "").trim() || null : null,
        contacted: null,
      },
    });
  }
  return out;
}

function parseCompaniesFromPaste(text: string): ImportRow<SuggestedTrackedCompany>[] {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n").filter(Boolean);
  const out: ImportRow<SuggestedTrackedCompany>[] = [];
  let started = false;

  for (const line of lines) {
    const cols = line.includes("\t") ? line.split("\t") : line.split(",");
    const name = (cols[0] ?? "").trim();
    if (!name) continue;
    if (!started && /target companies/i.test(name)) {
      started = true;
      continue;
    }
    if (/^(company|name|target)/i.test(name)) continue;
    out.push({
      id: nextId("co"),
      selected: true,
      source: "paste",
      data: { name, priority: "HIGH" },
    });
  }
  return out;
}

function parseJobTitlesFromPaste(text: string): {
  targetRoles: ImportRow<string>[];
  deprioritizedRoles: ImportRow<string>[];
} {
  const titles = parseRoleTitleList(text);
  return {
    targetRoles: titles.map((t) => ({
      id: nextId("role"),
      selected: true,
      source: "paste",
      data: t,
    })),
    deprioritizedRoles: [],
  };
}

function parseKeywordsFromPaste(text: string): {
  prioritizedCategories: ImportRow<string>[];
  deprioritizedCategories: ImportRow<string>[];
} {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const prioritized: ImportRow<string>[] = [];
  const deprioritized: ImportRow<string>[] = [];
  let mode: "use" | "avoid" | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (/^(use|to use|keywords to use|prioritize)/i.test(lower)) {
      mode = "use";
      const rest = line.replace(/^[^:]*:\s*/, "").trim();
      if (rest) {
        for (const kw of parseRoleTitleList(rest)) {
          prioritized.push({ id: nextId("kw"), selected: true, source: "paste", data: kw });
        }
      }
      continue;
    }
    if (/^(avoid|to avoid|keywords to avoid|deprioritize|pass on)/i.test(lower)) {
      mode = "avoid";
      const rest = line.replace(/^[^:]*:\s*/, "").trim();
      if (rest) {
        for (const kw of parseRoleTitleList(rest)) {
          deprioritized.push({ id: nextId("kw"), selected: true, source: "paste", data: kw });
        }
      }
      continue;
    }

    const cols = line.includes("\t") ? line.split("\t") : line.includes(",") ? line.split(",") : [line];
    if (cols.length >= 2) {
      const useVal = (cols[0] ?? "").trim();
      const avoidVal = (cols[1] ?? "").trim();
      if (useVal) prioritized.push({ id: nextId("kw"), selected: true, source: "paste", data: useVal });
      if (avoidVal) deprioritized.push({ id: nextId("kw"), selected: true, source: "paste", data: avoidVal });
      continue;
    }

    const items = parseRoleTitleList(line);
    for (const kw of items) {
      const row: ImportRow<string> = { id: nextId("kw"), selected: true, source: "paste", data: kw };
      if (mode === "avoid") deprioritized.push(row);
      else prioritized.push(row);
    }
  }

  return { prioritizedCategories: prioritized, deprioritizedCategories: deprioritized };
}

function parsePasswordsFromPaste(text: string): ImportRow<{ question: string; answer: string; tags: string[] }>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  const out: ImportRow<{ question: string; answer: string; tags: string[] }>[] = [];

  for (const line of lines) {
    let site = "";
    let password = "";
    if (line.includes("\t")) {
      const [a, b, ...rest] = line.split("\t");
      site = (a ?? "").trim();
      password = [b, ...rest].join("\t").trim();
    } else if (/^[^:]+:\s*.+$/.test(line) && !line.startsWith("http")) {
      const idx = line.indexOf(":");
      site = line.slice(0, idx).trim();
      password = line.slice(idx + 1).trim();
    } else if (line.includes(",")) {
      const idx = line.indexOf(",");
      site = line.slice(0, idx).trim();
      password = line.slice(idx + 1).trim();
    }
    if (!site || !password) continue;
    if (/^(site|service|portal|name|password)/i.test(site)) continue;
    out.push({
      id: nextId("pw"),
      selected: true,
      source: "paste",
      data: { question: site, answer: password, tags: ["passwords"] },
    });
  }
  return out;
}

/** Parse pasted text for a given import type. Returns a partial ClientImportPreview. */
export function parsePasteImport(importType: ImportType, text: string): ClientImportPreview {
  resetIds();
  const preview = emptyImportPreview();
  preview.sourceFiles = [{ filename: "paste", kind: "paste" }];
  const trimmed = text.trim();
  if (!trimmed) {
    preview.warnings.push("No text to parse.");
    return preview;
  }

  switch (importType) {
    case "job_tracker": {
      const jobs = parseJobsFromPaste(trimmed, "paste", false);
      preview.pipelineJobs = jobs;
      preview.warnings = jobs.length ? [`Parsed ${jobs.length} jobs from paste.`] : ["Could not detect job rows — include Company and Job Title headers."];
      break;
    }
    case "interview_tracker": {
      const jobs = parseJobsFromPaste(trimmed, "Interview Tracker", true);
      preview.pipelineJobs = jobs;
      preview.warnings = jobs.length
        ? [`Parsed ${jobs.length} interview jobs from paste.`]
        : ["Could not detect interview rows — include Company and Job Title headers."];
      break;
    }
    case "contacts": {
      preview.contacts = parseContactsFromPaste(trimmed);
      preview.warnings = preview.contacts.length
        ? [`Parsed ${preview.contacts.length} contacts.`]
        : ["Could not detect contacts — include an Email column."];
      break;
    }
    case "target_companies": {
      preview.companies = parseCompaniesFromPaste(trimmed);
      preview.warnings = preview.companies.length
        ? [`Parsed ${preview.companies.length} companies.`]
        : ["No company names found — one per line works too."];
      break;
    }
    case "job_titles": {
      const titles = parseJobTitlesFromPaste(trimmed);
      preview.profile.targetRoles = titles.targetRoles;
      preview.profile.deprioritizedRoles = titles.deprioritizedRoles;
      preview.warnings =
        titles.targetRoles.length || titles.deprioritizedRoles.length
          ? [`Parsed ${titles.targetRoles.length} target roles.`]
          : ["No job titles found."];
      break;
    }
    case "keywords": {
      const kw = parseKeywordsFromPaste(trimmed);
      preview.profile.prioritizedCategories = kw.prioritizedCategories;
      preview.profile.deprioritizedCategories = kw.deprioritizedCategories;
      preview.warnings =
        kw.prioritizedCategories.length || kw.deprioritizedCategories.length
          ? [`${kw.prioritizedCategories.length} to use, ${kw.deprioritizedCategories.length} to avoid.`]
          : ["No keywords found."];
      break;
    }
    case "passwords": {
      preview.applicationQa = parsePasswordsFromPaste(trimmed);
      preview.warnings = preview.applicationQa.length
        ? [`Parsed ${preview.applicationQa.length} password entries.`]
        : ["No password entries — use Site\\tPassword or Site: Password format."];
      break;
    }
    default:
      preview.warnings.push("Paste not supported for this type — use file upload.");
  }

  return preview;
}

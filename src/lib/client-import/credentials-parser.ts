import type { ImportApplicationQa, ImportRow } from "@/lib/client-import/types";

export const CREDENTIALS_STORAGE_DISCLAIMER =
  "Login credentials are stored in plain text in the Application Q&A bank — not encrypted or highly secure. Only store them if the client accepts that tradeoff.";

let rowCounter = 0;

export function resetCredentialIds() {
  rowCounter = 0;
}

function nextId(): string {
  rowCounter += 1;
  return `cred_${rowCounter}`;
}

function isHeaderCell(value: string): boolean {
  return /^(site|service|portal|name|login|username|user|email|password|credentials?)$/i.test(value.trim());
}

/** Format stored answer — login optional, password required. */
export function formatCredentialAnswer(login: string | null, password: string): string {
  const lines: string[] = [];
  if (login?.trim()) lines.push(`Login: ${login.trim()}`);
  lines.push(`Password: ${password.trim()}`);
  return lines.join("\n");
}

function credentialRow(
  site: string,
  login: string | null,
  password: string,
  source: string,
): ImportRow<ImportApplicationQa> | null {
  const question = site.trim();
  const pwd = password.trim();
  if (!question || !pwd) return null;
  if (isHeaderCell(question)) return null;
  return {
    id: nextId(),
    selected: true,
    source,
    data: {
      question,
      answer: formatCredentialAnswer(login, pwd),
      tags: ["passwords", "credentials"],
    },
  };
}

/** Parse credential lines from pasted text (tab, comma, or colon separated). */
export function parseCredentialsFromText(text: string, source = "paste"): ImportRow<ImportApplicationQa>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
  const out: ImportRow<ImportApplicationQa>[] = [];

  for (const line of lines) {
    if (line.includes("\t")) {
      const cols = line.split("\t").map((c) => c.trim());
      const [site, col2, col3] = cols;
      if (!site) continue;
      if (col3) {
        const row = credentialRow(site, col2 ?? null, col3, source);
        if (row) out.push(row);
      } else if (col2) {
        const row = credentialRow(site, null, col2, source);
        if (row) out.push(row);
      }
      continue;
    }

    if (/^[^:]+:\s*.+$/.test(line) && !line.startsWith("http")) {
      const idx = line.indexOf(":");
      const site = line.slice(0, idx).trim();
      const rest = line.slice(idx + 1).trim();
      if (!site || !rest) continue;
      const slashIdx = rest.indexOf("/");
      if (slashIdx > 0) {
        const row = credentialRow(site, rest.slice(0, slashIdx).trim(), rest.slice(slashIdx + 1).trim(), source);
        if (row) out.push(row);
      } else {
        const row = credentialRow(site, null, rest, source);
        if (row) out.push(row);
      }
      continue;
    }

    if (line.includes(",")) {
      const parts = line.split(",").map((c) => c.trim());
      if (parts.length >= 3) {
        const row = credentialRow(parts[0]!, parts[1]!, parts[2]!, source);
        if (row) out.push(row);
      } else if (parts.length === 2) {
        const row = credentialRow(parts[0]!, null, parts[1]!, source);
        if (row) out.push(row);
      }
    }
  }

  return out;
}

type CredentialSheetRow = {
  siteCol: number;
  loginCol: number;
  passwordCol: number;
};

function detectCredentialColumns(headers: string[]): CredentialSheetRow | null {
  let siteCol = -1;
  let loginCol = -1;
  let passwordCol = -1;

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() ?? "";
    if (!h) continue;
    if (/^(site|service|portal|platform|account|name|company)/.test(h) && siteCol < 0) siteCol = i;
    else if (/^(login|username|user name|user id|email)/.test(h) && loginCol < 0) loginCol = i;
    else if (/^password/.test(h) && passwordCol < 0) passwordCol = i;
  }

  if (siteCol < 0 && passwordCol < 0) return null;
  if (siteCol < 0 && passwordCol >= 0) siteCol = passwordCol > 0 ? 0 : 1;
  if (passwordCol < 0 && loginCol >= 0 && siteCol >= 0) passwordCol = Math.max(siteCol, loginCol) + 1;

  return siteCol >= 0 && passwordCol >= 0 ? { siteCol, loginCol, passwordCol } : null;
}

/** Parse credentials from a spreadsheet tab (header row + data rows). */
export function parseCredentialsFromSheetRows(
  rows: string[][],
  sheetName: string,
): ImportRow<ImportApplicationQa>[] {
  if (!rows.length) return [];

  let headerIdx = -1;
  let cols: CredentialSheetRow | null = null;

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const detected = detectCredentialColumns(rows[i] ?? []);
    if (detected) {
      headerIdx = i;
      cols = detected;
      break;
    }
  }

  if (headerIdx < 0 || !cols) {
    const text = rows.map((r) => r.join("\t")).join("\n");
    return parseCredentialsFromText(text, sheetName);
  }

  const out: ImportRow<ImportApplicationQa>[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const site = row[cols.siteCol]?.trim() ?? "";
    const login = cols.loginCol >= 0 ? row[cols.loginCol]?.trim() || null : null;
    const password = row[cols.passwordCol]?.trim() ?? "";
    const cred = credentialRow(site, login, password, sheetName);
    if (cred) out.push(cred);
  }

  return out;
}

export function dedupeCredentials(rows: ImportRow<ImportApplicationQa>[]): ImportRow<ImportApplicationQa>[] {
  const byKey = new Map<string, ImportRow<ImportApplicationQa>>();
  for (const row of rows) {
    const key = row.data.question.trim().toLowerCase();
    if (!key) continue;
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

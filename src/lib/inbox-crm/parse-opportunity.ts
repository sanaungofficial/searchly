/** Heuristic hints for creating a pipeline opportunity from an email subject. */
export function parseOpportunityFromSubject(subject: string | null | undefined): {
  role: string | null;
  company: string | null;
} {
  const raw = (subject ?? "").trim();
  if (!raw) return { role: null, company: null };

  let role: string | null = null;
  const opportunityMatch = raw.match(/(?:new opportunity|opportunity|role|position)\s*:\s*(.+)/i);
  if (opportunityMatch?.[1]) {
    role = opportunityMatch[1].split(/\s+at\s+/i)[0]?.trim() ?? null;
  }

  if (!role) {
    const atMatch = raw.match(/^(.+?)\s+at\s+([A-Za-z0-9&.\- ]+)/i);
    if (atMatch) {
      role = atMatch[1].trim();
    }
  }

  if (role) {
    role = role.replace(/\s+in\s+remote.*$/i, "").replace(/\([^)]*\)\s*$/i, "").trim();
    if (role.length > 80) role = role.slice(0, 80).trim();
  }

  const companyMatch = raw.match(/\bat\s+([A-Za-z0-9&.\- ]+?)(?:\s+[-–—]|\s+in\s+|\s*\(|$)/i);
  const company = companyMatch?.[1]?.trim() ?? null;

  return { role: role || null, company };
}

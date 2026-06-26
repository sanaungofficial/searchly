/** Parse pasted role/category lists without breaking titles that contain commas. */

export function normalizeRoleTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

const STANDALONE_ROLE_PREFIX =
  /^(?:director|manager|lead|head|principal|vp|svp|evp|associate|assistant|coordinator|specialist|consultant|advisor|analyst|architect|engineer|supervisor|superintendent|foreman|captain|chief)\s*(?:[iIvV]{1,3}|[1-9])?\.?$/i;

function stripLinePrefix(line: string): string {
  return line.replace(/^\s*(?:[-*•◦▪·]\s*|\d+[.)]\s*)/, "").trim();
}

/** Commas inside titles (e.g. "Director, Product Management") vs list separators. */
function commaLooksLikeTitleContinuation(left: string, right: string): boolean {
  const l = left.trim();
  const r = right.trim();
  if (!r) return true;
  if (STANDALONE_ROLE_PREFIX.test(l)) return true;
  if (/^principal\s+[iIvV0-9]+$/i.test(l)) return true;
  return false;
}

function splitCommaSeparatedIfList(text: string): string[] {
  const parts = text.split(/,\s*/);
  if (parts.length <= 1) return [text];

  const merged: string[] = [];
  let current = parts[0].trim();
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i].trim();
    if (commaLooksLikeTitleContinuation(current, next)) {
      current = `${current}, ${next}`;
    } else {
      if (current) merged.push(current);
      current = next;
    }
  }
  if (current) merged.push(current);
  return merged.length > 1 ? merged : [text];
}

/**
 * Prefer one role per line. Also accepts semicolon-separated lists and comma-separated
 * lists when segments look like separate titles (not "Director, Product Management").
 */
export function parseRoleTitleList(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];

  const normalized = text.replace(/\r\n/g, "\n").trim();

  let segments: string[];
  if (normalized.includes("\n")) {
    segments = normalized.split("\n");
  } else if (/;\s*/.test(normalized)) {
    segments = normalized.split(/;\s*/);
  } else if (normalized.includes(",")) {
    segments = splitCommaSeparatedIfList(normalized);
  } else {
    segments = [normalized];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const seg of segments) {
    const title = normalizeRoleTitle(stripLinePrefix(seg));
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(title);
  }
  return result;
}

export function mergeRoleTitleLists(
  existing: string[],
  incoming: string[],
): { merged: string[]; added: string[] } {
  const seen = new Set(existing.map((r) => r.toLowerCase()));
  const added: string[] = [];
  const merged = [...existing];
  for (const title of incoming) {
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(title);
    merged.push(title);
  }
  return { merged, added };
}

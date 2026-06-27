/** Stable key for matching the same posting across re-imports (URL preferred). */
export function normalizeImportJobUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);

    const linkedinMatch = u.pathname.match(/\/jobs\/view\/(\d+)/i);
    if (linkedinMatch) return `linkedin:job:${linkedinMatch[1]}`;

    const leverMatch = u.pathname.match(/\/([^/]+(?:\/[^/]+)?)\/?$/);
    if (u.hostname.includes("lever.co") && leverMatch) {
      return `lever:${u.hostname}${leverMatch[0]}`.toLowerCase();
    }

    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (
        lower.startsWith("utm_") ||
        lower === "trackingid" ||
        lower === "ref" ||
        lower === "source" ||
        lower === "trk" ||
        lower === "gh_src"
      ) {
        u.searchParams.delete(key);
      }
    }

    const path = u.pathname.replace(/\/$/, "");
    const query = u.searchParams.toString();
    return `${u.origin}${path}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function importJobDedupeKey(data: {
  url: string | null;
  company: string;
  role: string;
}): string {
  return (
    normalizeImportJobUrl(data.url) ??
    `${data.company.trim().toLowerCase()}::${data.role.trim().toLowerCase()}`
  );
}

export function truncateImportJobUrl(url: string, max = 64): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

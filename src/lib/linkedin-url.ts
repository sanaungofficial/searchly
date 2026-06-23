const LINKEDIN_PROFILE_RE =
  /^https?:\/\/(www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)\/?(\?.*)?$/i;

/** Normalize user input to a canonical LinkedIn profile URL, or null if invalid. */
export function normalizeLinkedInUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = candidate.replace(/^\/\//, "");
    if (/^linkedin\.com\//i.test(candidate) || /^www\.linkedin\.com\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else if (/^in\//i.test(candidate)) {
      candidate = `https://linkedin.com/${candidate}`;
    } else {
      candidate = `https://linkedin.com/in/${candidate.replace(/^@/, "")}`;
    }
  }

  try {
    const url = new URL(candidate);
    if (!/linkedin\.com$/i.test(url.hostname.replace(/^www\./, ""))) return null;

    const match = url.href.match(LINKEDIN_PROFILE_RE);
    if (!match) return null;

    const slug = decodeURIComponent(match[2]).replace(/\/+$/, "");
    if (!slug) return null;

    return `https://www.linkedin.com/in/${slug}`;
  } catch {
    return null;
  }
}

export function isValidLinkedInProfileUrl(input: string): boolean {
  return normalizeLinkedInUrl(input) !== null;
}

/** Normalize a LinkedIn handle or pasted URL to a canonical profile URL. */
export function normalizeLinkedInUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let handle = trimmed;
  if (/linkedin\.com/i.test(trimmed)) {
    const match = trimmed.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
    if (!match?.[1]) return null;
    handle = match[1];
  }

  handle = handle.replace(/^@/, "").replace(/\/+$/, "");
  if (!handle || !/^[a-zA-Z0-9_-]+$/.test(handle)) return null;

  return `https://www.linkedin.com/in/${handle}/`;
}

/** Extract username from a stored LinkedIn URL for display in prefix inputs. */
export function linkedInHandleFromUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  const match = url.trim().match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  return match?.[1]?.replace(/\/+$/, "") ?? "";
}

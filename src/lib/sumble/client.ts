const SUMBLE_BASE = "https://api.sumble.com";

export function isSumbleConfigured(): boolean {
  return Boolean(
    process.env.SUMBLE_API_KEY?.trim() ||
      process.env.SUMBLE_API_TOKEN?.trim(),
  );
}

function sumbleApiKey(): string {
  const key =
    process.env.SUMBLE_API_KEY?.trim() ||
    process.env.SUMBLE_API_TOKEN?.trim();
  if (!key) throw new Error("SUMBLE_NOT_CONFIGURED");
  return key;
}

export type SumbleFetchResult<T> =
  | { ok: true; data: T; creditsUsed?: number }
  | { ok: false; status: number; error: string };

export async function sumblePost<T>(
  path: string,
  body: unknown,
): Promise<SumbleFetchResult<T>> {
  try {
    const res = await fetch(`${SUMBLE_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sumbleApiKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const detail =
        parsed &&
        typeof parsed === "object" &&
        "detail" in parsed &&
        typeof (parsed as { detail?: unknown }).detail === "string"
          ? (parsed as { detail: string }).detail
          : text.slice(0, 240) || res.statusText;
      return { ok: false, status: res.status, error: detail };
    }

    const creditsUsed =
      parsed &&
      typeof parsed === "object" &&
      "credits_used" in parsed &&
      typeof (parsed as { credits_used?: number }).credits_used === "number"
        ? (parsed as { credits_used: number }).credits_used
        : undefined;

    return { ok: true, data: parsed as T, creditsUsed };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Sumble request failed",
    };
  }
}

export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

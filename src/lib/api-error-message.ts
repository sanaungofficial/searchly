/** Coerce API / thrown errors into user-readable strings (never [object Object]). */
export function formatApiErrorMessage(value: unknown, fallback = "Something went wrong."): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (value instanceof Error) return value.message.trim() || fallback;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim();
    if (typeof obj.msg === "string" && obj.msg.trim()) {
      return obj.msg.replace(/^Value error,\s*/i, "").trim() || fallback;
    }
    if (typeof obj.detail === "string" && obj.detail.trim()) return obj.detail.trim();
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error.trim();
    if (obj.error && typeof obj.error === "object") {
      const nested = obj.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message.trim()) {
        return nested.message.trim();
      }
    }
    if (Array.isArray(obj.detail)) {
      const parts = obj.detail.map((item) => formatApiErrorMessage(item, "")).filter(Boolean);
      if (parts.length) return parts.join("; ");
    }
    if (obj.detail && typeof obj.detail === "object") {
      return formatApiErrorMessage(obj.detail, fallback);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

export function formatHirebaseErrorBody(body: string, status: number): string {
  const trimmed = body.trim();
  if (!trimmed) return `Hirebase request failed (${status})`;
  try {
    return formatApiErrorMessage(JSON.parse(trimmed), `Hirebase request failed (${status})`);
  } catch {
    return trimmed;
  }
}

/** Map Anthropic SDK / provider failures to a JSON NextResponse. */
export function anthropicFailureMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      error?: { error?: { message?: string }; message?: string };
    };
    const nested = e.error?.error?.message ?? e.error?.message;
    const raw = nested ?? e.message ?? "";
    if (/credit balance is too low/i.test(raw)) {
      return "Anthropic API credits are exhausted. Add credits in Anthropic billing or try again later.";
    }
    if (raw.trim()) return raw.trim();
  }
  return formatApiErrorMessage(err, "AI request failed");
}

export async function readResponseJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Empty response from server"
        : `Request failed (${res.status}). The server may have crashed — check logs.`,
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text.slice(0, 240) || `Invalid response (${res.status})`);
  }
}

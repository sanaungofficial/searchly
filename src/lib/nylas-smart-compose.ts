import { getNylasConfig, isNylasConfigured, nylasFetch } from "@/lib/nylas";

type SmartComposeResponse = {
  data?: { suggestion?: string };
  suggestion?: string;
};

export function isNylasSmartComposeAvailable(): boolean {
  return isNylasConfigured();
}

function readSuggestion(res: SmartComposeResponse): string {
  const text = res.data?.suggestion ?? res.suggestion ?? "";
  return text.trim();
}

/** Nylas-hosted AI — generate text from a prompt with optional message thread context. */
export async function nylasSmartComposeReply(
  grantId: string,
  messageId: string,
  prompt: string,
): Promise<string> {
  const encodedId = encodeURIComponent(messageId);
  const res = await nylasFetch<SmartComposeResponse>(
    `/v3/grants/${grantId}/messages/${encodedId}/smart-compose`,
    {
      method: "POST",
      grantId,
      body: { prompt },
    },
  );
  const suggestion = readSuggestion(res);
  if (!suggestion) throw new Error("NYLAS_SMART_COMPOSE_EMPTY");
  return suggestion;
}

/** Nylas-hosted AI — generate text without an existing message (uses grant context only). */
export async function nylasSmartComposeMessage(grantId: string, prompt: string): Promise<string> {
  const res = await nylasFetch<SmartComposeResponse>(`/v3/grants/${grantId}/messages/smart-compose`, {
    method: "POST",
    grantId,
    body: { prompt },
  });
  const suggestion = readSuggestion(res);
  if (!suggestion) throw new Error("NYLAS_SMART_COMPOSE_EMPTY");
  return suggestion;
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function nylasSmartComposeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Nylas email AI is unavailable.";
  if (err.message === "NYLAS_SMART_COMPOSE_EMPTY") return "Nylas returned an empty suggestion.";
  if (err.message.includes("Nylas is not configured")) return "Nylas is not configured.";
  return err.message;
}

/** Best-effort check that Smart Compose is enabled on the Nylas app (prod only). */
export function nylasSmartComposeConfigured(): boolean {
  return getNylasConfig() !== null;
}

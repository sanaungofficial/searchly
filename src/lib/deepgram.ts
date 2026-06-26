const DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen";
const DEEPGRAM_GRANT_URL = "https://api.deepgram.com/v1/auth/grant";

export function deepgramConfigured(): boolean {
  return !!process.env.DEEPGRAM_API_KEY?.trim();
}

/** Short-lived JWT for browser Voice Agent WebSocket (default TTL 30s — use ttlSeconds for sessions). */
export async function createDeepgramGrantToken(ttlSeconds = 600): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }

  const response = await fetch(DEEPGRAM_GRANT_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: ttlSeconds }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Deepgram grant failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Deepgram grant returned no access_token");
  }
  return data.access_token;
}

export type DeepgramTranscriptResult = {
  transcript: string;
  durationSeconds: number | null;
};

export async function transcribeAudio(
  audio: Buffer | ArrayBuffer,
  mimeType: string,
): Promise<DeepgramTranscriptResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    model: "nova-3",
    smart_format: "true",
    punctuate: "true",
    language: "en",
  });

  const bodyBytes =
    audio instanceof Buffer ? new Uint8Array(audio) : new Uint8Array(audio);
  const response = await fetch(`${DEEPGRAM_LISTEN_URL}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": mimeType || "audio/webm",
    },
    body: bodyBytes,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Deepgram transcription failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const data = (await response.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string }>;
      }>;
    };
    metadata?: { duration?: number };
  };

  const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
  if (!transcript) {
    throw new Error("No speech detected — try speaking a little longer.");
  }

  return {
    transcript,
    durationSeconds: typeof data.metadata?.duration === "number" ? data.metadata.duration : null,
  };
}

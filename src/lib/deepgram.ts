const DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen";

export function deepgramConfigured(): boolean {
  return !!process.env.DEEPGRAM_API_KEY?.trim();
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

  const body = audio instanceof Buffer ? audio : Buffer.from(audio);
  const response = await fetch(`${DEEPGRAM_LISTEN_URL}?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": mimeType || "audio/webm",
    },
    body,
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

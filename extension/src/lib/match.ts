import { fetchWithKimchiAuth } from "./auth";
import { getSettings } from "./storage";
import type { JobMatchResult } from "./types";

export async function fetchJobMatch(input: {
  jobTitle: string;
  company: string;
  description: string;
}): Promise<{ ok: true; data: JobMatchResult } | { ok: false; error: string }> {
  const { env } = await getSettings();

  try {
    const res = await fetchWithKimchiAuth(env, "/api/ai/job-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = (await res.json()) as JobMatchResult & { error?: string };

    if (!res.ok) {
      return { ok: false, error: data.error ?? `Match failed (${res.status})` };
    }

    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Match request failed",
    };
  }
}

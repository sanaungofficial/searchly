import { fetchWithKimchiAuth } from "./auth";
import { getSettings } from "./storage";
import type { ParsedJob, SaveJobResult } from "./types";

export async function saveJob(parsed: ParsedJob): Promise<SaveJobResult> {
  const { env } = await getSettings();

  try {
    const res = await fetchWithKimchiAuth(env, "/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: parsed.company,
        role: parsed.role,
        url: parsed.url,
        stage: parsed.stage,
        notes: parsed.notes,
      }),
    });

    const data = (await res.json()) as { id?: string; error?: string };

    if (!res.ok) {
      return { ok: false, error: data.error ?? `Request failed (${res.status})` };
    }

    return { ok: true, jobId: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

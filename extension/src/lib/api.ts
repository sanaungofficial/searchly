import { checkAuth, fetchWithKimchiAuth } from "./auth";
import type { ParsedJob, SaveJobResult } from "./types";

export async function saveJob(parsed: ParsedJob): Promise<SaveJobResult> {
  const auth = await checkAuth(true);
  if (!auth.authenticated) {
    return {
      ok: false,
      error: "Sign in to Kimchi first — use the sidebar on this page.",
    };
  }

  try {
    const res = await fetchWithKimchiAuth("/api/jobs", {
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

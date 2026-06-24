export type JobListingUrlResult =
  | { ok: true; url: string; normalized: boolean }
  | { ok: false; error: string };

/** Normalize pasted URLs (e.g. LinkedIn search with currentJobId) before parse. */
export function normalizeJobListingUrl(raw: string): JobListingUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste a job listing URL to continue." };
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "Enter a valid job listing URL." };
  }

  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname;

  if (host.includes("linkedin.com")) {
    const viewMatch = path.match(/\/jobs\/view\/(\d+)/);
    if (viewMatch) {
      return {
        ok: true,
        url: `https://www.linkedin.com/jobs/view/${viewMatch[1]}/`,
        normalized: url.toString() !== `https://www.linkedin.com/jobs/view/${viewMatch[1]}/`,
      };
    }

    const jobId = url.searchParams.get("currentJobId");
    if (jobId && /^\d+$/.test(jobId)) {
      return {
        ok: true,
        url: `https://www.linkedin.com/jobs/view/${jobId}/`,
        normalized: true,
      };
    }

    if (path.includes("/jobs/search") || path.includes("/jobs/collections")) {
      return {
        ok: false,
        error:
          "That link opens a job search, not one listing. Open a single job and paste its URL (linkedin.com/jobs/view/…).",
      };
    }
  }

  if (host.includes("indeed.com") && (path === "/jobs" || path.startsWith("/jobs?") || path === "/q")) {
    return {
      ok: false,
      error: "That looks like a search results page. Open one job and paste its listing URL.",
    };
  }

  return { ok: true, url: url.toString(), normalized: url.toString() !== trimmed };
}

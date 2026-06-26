import { cachedJobToMeta } from "@/lib/cached-job";
import { fetchHirebaseMatchingJobs } from "@/lib/hirebase";

/** Best-effort Hirebase lookup so saved roles use real titles, URLs, and posting metadata. */
export async function enrichEmailRoleGuess(company: string, roleGuess: string) {
  if (!process.env.HIREBASE_API_KEY?.trim()) return null;

  const companyName = company.trim();
  const role = roleGuess.trim();
  if (!companyName || !role) return null;

  try {
    const { jobs } = await fetchHirebaseMatchingJobs({
      companyName,
      jobTitles: [role],
      maxJobs: 3,
    });
    const best = jobs[0];
    if (!best) return null;

    return {
      company: companyName,
      role: best.title?.trim() || role,
      url: best.url ?? null,
      notes: JSON.stringify(cachedJobToMeta(best)),
    };
  } catch (err) {
    console.error("[inbox-role-enrich]", companyName, role, err);
    return null;
  }
}

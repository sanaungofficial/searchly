import type { InboxActivityCategory, Job } from "@prisma/client";

function normalizeCompany(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchJobForContact(
  jobs: Job[],
  params: {
    contactCompany?: string | null;
    contactEmail?: string | null;
    subject?: string | null;
    category?: InboxActivityCategory | string;
  },
): Job | null {
  const category = params.category ?? "UNKNOWN";
  if (category !== "JOB_SEARCH" && category !== "RECRUITER") return null;

  const nc = normalizeCompany(params.contactCompany);
  const domain = params.contactEmail?.split("@")[1]?.split(".")[0] ?? "";
  const nd = normalizeCompany(domain);
  const subject = (params.subject ?? "").toLowerCase();

  const scored = jobs
    .map((job) => {
      let score = 0;
      const jc = normalizeCompany(job.company);
      if (nc && jc && (jc.includes(nc) || nc.includes(jc))) score += 4;
      if (nd && jc && (jc.includes(nd) || nd.includes(jc))) score += 2;
      if (subject.includes(job.company.toLowerCase())) score += 3;
      const role = job.role.trim().toLowerCase();
      if (role && subject.includes(role)) score += 1;
      return { job, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.job ?? null;
}

import { prisma } from "@/lib/prisma";
import type { ExternalApiProvider } from "@prisma/client";

export type ExternalApiLogInput = {
  provider: ExternalApiProvider;
  operation: string;
  userId?: string | null;
  units?: number;
  costUsd?: number;
  meta?: Record<string, unknown>;
};

export function normalizeHirebaseOperation(path: string, method = "GET"): string {
  const p = path.split("?")[0] ?? path;
  if (p.includes("/v2/jobs/vsearch")) return "jobs.vsearch";
  if (p.includes("/v2/jobs/search")) return "jobs.search";
  if (p.includes("/v2/jobs/")) return "jobs.get";
  if (p.includes("/companies/search")) return "companies.search";
  if (p.includes("/companies/") && p.includes("/jobs")) return "companies.jobs";
  if (p.includes("/companies/")) return "companies.get";
  if (p.includes("/resumes/embed")) return "resumes.embed";
  return p.replace(/^\/v2\//, "").slice(0, 64) || "unknown";
}

export function countHirebaseResultUnits(data: unknown): number {
  if (!data || typeof data !== "object") return 1;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.jobs)) {
    return Math.max(1, record.jobs.length);
  }
  return 1;
}

export function estimateHirebaseCost(operation: string, units: number): number {
  const perJob = Number(process.env.HIREBASE_USD_PER_JOB ?? 0.002);
  const perCall = Number(process.env.HIREBASE_USD_PER_API_CALL ?? 0.001);
  const perResume = Number(process.env.HIREBASE_USD_PER_RESUME_EMBED ?? 0.02);

  const perUnit: Record<string, number> = {
    "jobs.vsearch": Number(process.env.HIREBASE_USD_PER_VSEARCH_JOB ?? perJob),
    "jobs.search": Number(process.env.HIREBASE_USD_PER_SEARCH_JOB ?? perJob),
    "jobs.get": perCall,
    "companies.jobs": Number(process.env.HIREBASE_USD_PER_SEARCH_JOB ?? perJob),
    "companies.search": perCall,
    "companies.get": perCall,
    "resumes.embed": perResume,
  };

  return (perUnit[operation] ?? perCall) * Math.max(1, units);
}

export function estimateApifyCost(runs = 1): number {
  const perRun = Number(process.env.APIFY_USD_PER_LINKEDIN_RUN ?? 0.004);
  return perRun * Math.max(1, runs);
}

export function logExternalApiUsage(input: ExternalApiLogInput): void {
  const units = Math.max(1, input.units ?? 1);
  const costUsd = input.costUsd ?? 0;

  prisma.externalApiUsageLog
    .create({
      data: {
        provider: input.provider,
        operation: input.operation.slice(0, 128),
        userId: input.userId ?? null,
        units,
        costUsd,
        meta: input.meta ?? undefined,
      },
    })
    .catch(() => {});
}

export function logHirebaseApiCall(input: {
  path: string;
  method?: string;
  userId?: string | null;
  data?: unknown;
  status?: number;
}): void {
  const operation = normalizeHirebaseOperation(input.path, input.method ?? "GET");
  const units = input.data != null ? countHirebaseResultUnits(input.data) : 1;
  logExternalApiUsage({
    provider: "HIREBASE",
    operation,
    userId: input.userId,
    units,
    costUsd: estimateHirebaseCost(operation, units),
    meta: { path: input.path, method: input.method ?? "GET", status: input.status },
  });
}

export function logApifyLinkedInRun(userId?: string | null): void {
  logExternalApiUsage({
    provider: "APIFY",
    operation: "linkedin.profile_scrape",
    userId,
    units: 1,
    costUsd: estimateApifyCost(1),
    meta: { actor: process.env.APIFY_LINKEDIN_ACTOR_ID ?? "harvestapi/linkedin-profile-scraper" },
  });
}

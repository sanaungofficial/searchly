import { JobStage } from "@prisma/client";
import { requireAiQuota } from "@/lib/ai-guard";
import { buildAssistantContext } from "@/lib/kimchi-assistant/context";
import { formatLabeledContextForPrompt, companySourceRoute } from "@/lib/kimchi-assistant/context-sources";
import { inferInterviewFormat } from "@/lib/kimchi-assistant/voice-tools/interview-inference";
import { parseJobPostingFromUrl } from "@/lib/kimchi-assistant/voice-tools/job-posting-parse";
import { jobStageLabel } from "@/lib/kimchi-assistant/stages";
import { mergeTrackedWithIntel } from "@/lib/company-intel";
import { scanTrackedCompanyMatches, parseJobsCache } from "@/lib/company-jobs-scan";
import { generateInterviewPrep } from "@/lib/job-email-agent";
import { prisma } from "@/lib/prisma";
import { pipelineJobUrl } from "@/lib/workspace-urls";

export type VoiceToolResult = { ok: true; data: unknown } | { ok: false; error: string };

const INTERVIEW_STAGES = [JobStage.INTERVIEWING, JobStage.OFFER] as const;
const APPLIED_STAGES = [
  JobStage.APPLYING,
  JobStage.APPLIED,
  JobStage.SCREENING,
  JobStage.INTERVIEWING,
  JobStage.OFFER,
] as const;

type RoleRow = {
  id: string;
  company: string;
  role: string;
  stage: string;
  appliedAt: Date | null;
  fitAnalysis: string | null;
};

function roleSummary(j: RoleRow) {
  const fit = parseFitScore(j.fitAnalysis);
  return {
    id: j.id,
    company: j.company,
    role: j.role,
    stage: jobStageLabel(j.stage),
    fitScore: fit,
    spokenLabel: `${j.role} at ${j.company}`,
  };
}

function buildDisambiguationPrompt(roles: ReturnType<typeof roleSummary>[]) {
  if (roles.length === 0) {
    return "No matching roles found — ask which company and role they're thinking about.";
  }
  if (roles.length === 1) {
    const r = roles[0]!;
    return `Only one match — still confirm: "Still talking about ${r.spokenLabel}?"`;
  }
  const names = roles.map((r) => r.spokenLabel).join(", ");
  return `Multiple matches — ask which one: "I've got ${roles.length} on the go — ${names} — which one?" Never read ids aloud.`;
}

function parseFitScore(fitAnalysis: string | null): number | null {
  if (!fitAnalysis) return null;
  try {
    const parsed = JSON.parse(fitAnalysis) as { score?: number; matchScore?: number };
    if (typeof parsed.matchScore === "number") return Math.min(100, Math.round(parsed.matchScore));
    if (typeof parsed.score === "number") return Math.min(100, Math.round(parsed.score * 10));
  } catch {
    /* ignore */
  }
  return null;
}

function parseFitRationale(fitAnalysis: string | null): string | null {
  if (!fitAnalysis) return null;
  try {
    const parsed = JSON.parse(fitAnalysis) as { summaryNote?: string; matchReasons?: unknown };
    if (typeof parsed.summaryNote === "string" && parsed.summaryNote.trim()) {
      return parsed.summaryNote.trim().slice(0, 300);
    }
    if (Array.isArray(parsed.matchReasons)) {
      const reasons = parsed.matchReasons.filter((r): r is string => typeof r === "string").slice(0, 3);
      if (reasons.length) return reasons.join("; ");
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function voiceListActiveRoles(
  userId: string,
  filter: "interviewing" | "applied" | "all" = "interviewing",
): Promise<VoiceToolResult> {
  const stageFilter =
    filter === "interviewing"
      ? { in: [...INTERVIEW_STAGES] }
      : filter === "applied"
        ? { in: [...APPLIED_STAGES] }
        : undefined;

  const jobs = await prisma.job.findMany({
    where: {
      userId,
      ...(stageFilter ? { stage: stageFilter } : {}),
    },
    orderBy: [{ stage: "asc" }, { updatedAt: "desc" }],
    take: 12,
    select: {
      id: true,
      company: true,
      role: true,
      stage: true,
      appliedAt: true,
      fitAnalysis: true,
    },
  });

  const roles = jobs.map(roleSummary);

  return {
    ok: true,
    data: {
      count: roles.length,
      filter,
      roles,
      needsChoice: roles.length > 1,
      spokenPrompt: buildDisambiguationPrompt(roles),
      coachingHint:
        "Read company + role names only. Ask which one. Do not call get_job_detail until they pick.",
    },
  };
}

export async function voiceRefreshContext(userId: string): Promise<VoiceToolResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, subscription: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const ctx = await buildAssistantContext({ user });
  return {
    ok: true,
    data: {
      summary: ctx.summary,
      context: formatLabeledContextForPrompt(ctx),
      sources: ctx.contextSources,
    },
  };
}

export async function voiceGetJobDetail(
  userId: string,
  jobId: string,
  opts?: { parsePosting?: boolean },
): Promise<VoiceToolResult> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: {
      id: true,
      company: true,
      role: true,
      stage: true,
      url: true,
      notes: true,
      userNotes: true,
      appliedAt: true,
      fitAnalysis: true,
    },
  });
  if (!job) return { ok: false, error: "I couldn't find that role — ask which company and title they mean." };

  let posting: Awaited<ReturnType<typeof parseJobPostingFromUrl>> | null = null;
  if (opts?.parsePosting === true && job.url?.trim()) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, subscription: true },
    });
    if (user) {
      const quotaError = await requireAiQuota(user, "SCOUT");
      if (!quotaError) {
        try {
          posting = await parseJobPostingFromUrl(userId, job.url);
        } catch {
          /* optional */
        }
      }
    }
  }

  const description = posting?.description ?? null;
  const interviewInference = await inferInterviewFormat({
    userId,
    role: job.role,
    company: job.company,
    description,
    stage: job.stage,
  });

  let inboxPrep: unknown = null;
  const activity = await prisma.jobActivityLog.findFirst({
    where: { userId, jobId: job.id, signal: "INTERVIEW_INVITE" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (activity) {
    try {
      inboxPrep = await generateInterviewPrep(userId, activity.id);
    } catch {
      /* inbox prep optional */
    }
  }

  const fitScore = parseFitScore(job.fitAnalysis);
  const fitRationale = parseFitRationale(job.fitAnalysis);

  return {
    ok: true,
    data: {
      source: {
        label: "Active role",
        citeAs: `${job.role} at ${job.company}`,
        editRoute: pipelineJobUrl(job.id),
        fitRoute: pipelineJobUrl(job.id, "fit"),
      },
      job: {
        id: job.id,
        company: job.company,
        role: job.role,
        stage: jobStageLabel(job.stage),
        url: job.url,
        notes: job.notes,
        userNotes: job.userNotes,
        appliedAt: job.appliedAt?.toISOString() ?? null,
        fitScore,
        fitRationale,
      },
      posting: posting
        ? {
            role: posting.role,
            company: posting.company,
            location: posting.location,
            descriptionExcerpt: posting.description?.slice(0, 1500) ?? null,
            tags: posting.tags,
            source: posting.source,
          }
        : null,
      interviewInference,
      inboxPrep,
      coachingHint:
        "Confirm interview format in plain English using interviewInference.confirmQuestion — then ask one prep question.",
    },
  };
}

export async function voiceParseJobPosting(
  userId: string,
  args: { jobId?: string; url?: string },
): Promise<VoiceToolResult> {
  let url = args.url?.trim() ?? "";
  if (args.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: args.jobId, userId },
      select: { url: true, company: true, role: true },
    });
    if (!job) return { ok: false, error: "Job not found." };
    if (!job.url?.trim()) {
      return {
        ok: false,
        error: `I don't have a job link saved for ${job.role} at ${job.company} — ask them to paste the listing URL.`,
      };
    }
    url = job.url;
  }
  if (!url) return { ok: false, error: "Provide jobId or url." };

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { profile: true, subscription: true },
  });
  const quotaError = await requireAiQuota(user, "SCOUT");
  if (quotaError) return { ok: false, error: "You're out of lookups for today — skip pulling the listing unless they upgrade." };

  try {
    const parsed = await parseJobPostingFromUrl(userId, url);
    const { source: parseSource, ...rest } = parsed;
    return {
      ok: true,
      data: {
        ...rest,
        parseSource,
        source: { label: "Job listing", citeAs: "the job posting", url },
        descriptionExcerpt: parsed.description?.slice(0, 2000) ?? null,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not parse posting." };
  }
}

export async function voiceGetCompanyBrief(
  userId: string,
  args: { companyId?: string; companyName?: string },
): Promise<VoiceToolResult> {
  const company = args.companyId
    ? await prisma.trackedCompany.findFirst({
        where: { id: args.companyId, userId },
        include: { companyIntel: true },
      })
    : args.companyName
      ? await prisma.trackedCompany.findFirst({
          where: { userId, name: { contains: args.companyName, mode: "insensitive" } },
          include: { companyIntel: true },
        })
      : null;

  if (!company) return { ok: false, error: "I couldn't find that company — ask which one they mean." };

  const merged = mergeTrackedWithIntel(company, company.companyIntel);
  const enrichment =
    company.companyIntel?.enrichmentCache && typeof company.companyIntel.enrichmentCache === "object"
      ? (company.companyIntel.enrichmentCache as Record<string, unknown>)
      : null;

  const cache = parseJobsCache(merged.jobsCache);
  const openRoles = cache?.jobs?.slice(0, 8).map((j) => ({
    title: j.title,
    location: j.location ?? null,
    url: j.url ?? null,
  }));

  return {
    ok: true,
    data: {
      source: {
        label: "Tracked company",
        citeAs: company.name,
        editRoute: companySourceRoute(company.id),
      },
      company: {
        id: company.id,
        name: company.name,
        priority: company.priority,
        candidateEdge: company.candidateEdge,
        targetRoles: company.targetRoles,
        notes: company.notes,
        website: merged.website,
        careersUrl: merged.careersUrl,
      },
      intel: enrichment
        ? {
            industry: enrichment.industry ?? null,
            description:
              typeof enrichment.description === "string" ? enrichment.description.slice(0, 500) : null,
            employeeCount: enrichment.employeeCount ?? null,
          }
        : null,
      openRoles: openRoles ?? [],
      lastScanned: merged.lastJobsFetchedAt?.toISOString() ?? null,
    },
  };
}

export async function voiceScanCompanyRoles(userId: string, companyId: string): Promise<VoiceToolResult> {
  const result = await scanTrackedCompanyMatches(companyId, userId);
  if (!result.ok) return { ok: false, error: result.error };

  const cache = parseJobsCache(result.company.jobsCache);
  return {
    ok: true,
    data: {
      source: {
        label: "Company role check",
        citeAs: `what's open at ${result.company.name}`,
        editRoute: companySourceRoute(companyId),
      },
      company: result.company.name,
      matchCount: cache?.jobs?.length ?? 0,
      roles: (cache?.jobs ?? []).slice(0, 10).map((j) => ({
        title: j.title,
        location: j.location ?? null,
      })),
    },
  };
}

export async function voiceSaveJobNote(
  userId: string,
  jobId: string,
  note: string,
  mode: "append" | "replace" = "append",
): Promise<VoiceToolResult> {
  const trimmed = note.trim();
  if (!trimmed) return { ok: false, error: "Note text is required." };

  const job = await prisma.job.findFirst({ where: { id: jobId, userId } });
  if (!job) return { ok: false, error: "Job not found." };

  const stamped = `[Voice ${new Date().toLocaleDateString()}] ${trimmed}`;
  const userNotes =
    mode === "replace" ? stamped : [job.userNotes?.trim(), stamped].filter(Boolean).join("\n\n");

  await prisma.job.update({
    where: { id: jobId },
    data: { userNotes: userNotes.slice(0, 8000) },
  });

  return {
    ok: true,
    data: {
      jobId,
      company: job.company,
      role: job.role,
      editRoute: pipelineJobUrl(jobId),
      saved: true,
    },
  };
}

export async function executeVoiceTool(
  userId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<VoiceToolResult> {
  switch (tool) {
    case "list_active_roles":
      return voiceListActiveRoles(
        userId,
        args.filter === "applied" || args.filter === "all" ? args.filter : "interviewing",
      );
    case "refresh_context":
      return voiceRefreshContext(userId);
    case "get_job_detail":
      return typeof args.jobId === "string"
        ? voiceGetJobDetail(userId, args.jobId, {
            parsePosting: args.parsePosting === true,
          })
        : { ok: false, error: "jobId required" };
    case "parse_job_posting":
      return voiceParseJobPosting(userId, {
        jobId: typeof args.jobId === "string" ? args.jobId : undefined,
        url: typeof args.url === "string" ? args.url : undefined,
      });
    case "get_company_brief":
      return voiceGetCompanyBrief(userId, {
        companyId: typeof args.companyId === "string" ? args.companyId : undefined,
        companyName: typeof args.companyName === "string" ? args.companyName : undefined,
      });
    case "scan_company_roles":
      return typeof args.companyId === "string"
        ? voiceScanCompanyRoles(userId, args.companyId)
        : { ok: false, error: "companyId required" };
    case "save_job_note":
      return typeof args.jobId === "string" && typeof args.note === "string"
        ? voiceSaveJobNote(
            userId,
            args.jobId,
            args.note,
            args.mode === "replace" ? "replace" : "append",
          )
        : { ok: false, error: "jobId and note required" };
    default:
      return { ok: false, error: `Unknown voice tool: ${tool}` };
  }
}

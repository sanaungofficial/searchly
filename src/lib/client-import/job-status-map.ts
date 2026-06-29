import type { JobStage } from "@prisma/client";

export type ImportJobStageContext = {
  statusRaw: string;
  approved: boolean | null;
  appliedAt: string | null;
};

export type ImportStatusValueMapping = {
  /** Exact spreadsheet status cell text → Kimchi stage. */
  valueToStage: Record<string, JobStage>;
  /** Fallback when status text is present but not auto-mapped and not in valueToStage. */
  defaultUnmatchedStage: JobStage | null;
};

/** Kimchi pipeline stages available for import value mapping. */
export const IMPORT_JOB_STAGES: JobStage[] = [
  "SAVED",
  "APPLYING",
  "APPLIED",
  "SCREENING",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
];

/** Returns a Kimchi stage when status text matches built-in rules; null if user must map manually. */
export function tryAutoMapImportStatusText(statusRaw: string): JobStage | null {
  const v = statusRaw.trim().toLowerCase();
  if (!v) return null;
  return mapStatusText(v);
}

/** Map spreadsheet Application Status (+ optional Yes/No approval) to Kimchi JobStage. */
export function mapImportJobStage(
  ctx: ImportJobStageContext,
  valueMapping?: ImportStatusValueMapping,
): JobStage {
  return resolveImportJobStage(ctx, valueMapping);
}

/** Resolve stage with optional user value mapping for unrecognized status strings. */
export function resolveImportJobStage(
  ctx: ImportJobStageContext,
  valueMapping?: ImportStatusValueMapping,
): JobStage {
  const trimmed = ctx.statusRaw.trim();

  if (trimmed) {
    const userMapped = valueMapping?.valueToStage[trimmed];
    if (userMapped) return applyApprovalGate(userMapped, ctx.approved);

    const auto = tryAutoMapImportStatusText(trimmed);
    if (auto) return applyApprovalGate(auto, ctx.approved);

    const fallback = valueMapping?.defaultUnmatchedStage;
    if (fallback) return applyApprovalGate(fallback, ctx.approved);
  }

  if (ctx.appliedAt?.trim()) return applyApprovalGate("APPLIED", ctx.approved);
  if (ctx.approved === false) return "SAVED";
  if (ctx.approved === true) return "APPLYING";
  return "SAVED";
}

function applyApprovalGate(stage: JobStage, approved: boolean | null): JobStage {
  if (approved === false && (stage === "APPLIED" || stage === "APPLYING")) return "SAVED";
  return stage;
}

function mapStatusText(v: string): JobStage | null {
  if (/^(yes|y|true|1)$/.test(v)) return "APPLIED";
  if (/^(no|n|false|0)$/.test(v)) return "SAVED";

  if (/reject|declin|not selected|no offer|unsuccessful|closed lost|ghosted|passed/.test(v)) {
    return "REJECTED";
  }
  if (/withdraw|withdrew|pulled|rescind/.test(v)) return "WITHDRAWN";
  if (/offer|negotiat/.test(v)) return "OFFER";

  if (
    /interview|onsite|on site|on-site|second round|third round|final round|panel|assessment|case study|technical round|hiring manager/.test(
      v,
    )
  ) {
    return "INTERVIEWING";
  }
  if (/screen|recruiter call|phone screen|initial call|hm screen|hiring manager screen/.test(v)) {
    return "SCREENING";
  }

  if (/^applied|application sent|submitted|complete/.test(v) || /\bapplied\b/.test(v)) return "APPLIED";
  if (/applying|in progress|in-progress|draft|working on/.test(v)) return "APPLYING";
  if (/saved|bookmark|watch|pipeline|interested|target|to apply|not yet|queued|prospect|research/.test(v)) {
    return "SAVED";
  }
  if (/pending|waiting|hold|on hold|paused|inactive|closed/.test(v)) return "SAVED";

  return null;
}

export function parseImportApproved(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (/^(yes|y|true|1|approved|ok|go)$/.test(v)) return true;
  if (/^(no|n|false|0|not approved|pending approval|hold|wait)$/.test(v)) return false;
  return null;
}

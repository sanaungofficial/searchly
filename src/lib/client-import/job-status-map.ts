import type { JobStage } from "@prisma/client";

export type ImportJobStageContext = {
  statusRaw: string;
  approved: boolean | null;
  appliedAt: string | null;
};

/** Map spreadsheet Application Status (+ optional Yes/No approval) to Kimchi JobStage. */
export function mapImportJobStage(ctx: ImportJobStageContext): JobStage {
  const v = ctx.statusRaw.trim().toLowerCase();

  if (v) {
    const mapped = mapStatusText(v);
    if (mapped) return applyApprovalGate(mapped, ctx.approved);
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

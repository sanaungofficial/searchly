"use client";

import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontSans, border, type as T } from "@/lib/typography";
import { pipelineJobUrl } from "@/lib/workspace-urls";
import type { MessageActivity, PipelineJob } from "./inbox-types";
import { signalLabel } from "./inbox-types";

type ActivityLike = MessageActivity & { id: string; companyGuess?: string | null; roleGuess?: string | null };

type Props = {
  activity: ActivityLike;
  jobs: PipelineJob[];
  linkOpen: boolean;
  onToggleLink: () => void;
  onAction: (
    action: "accept" | "dismiss" | "link",
    extra?: { jobId?: string; createJob?: boolean; applyStage?: boolean },
  ) => void;
  compact?: boolean;
};

export function InboxActivityActions({ activity, jobs, linkOpen, onToggleLink, onAction, compact }: Props) {
  if (activity.status !== "PENDING_REVIEW") {
    if (activity.job) {
      return (
        <div
          style={{
            marginTop: compact ? 8 : 10,
            padding: "10px 12px",
            background: "rgba(42,107,74,0.08)",
            border: `1px solid rgba(42,107,74,0.2)`,
            borderRadius: "var(--scout-radius)",
          }}
        >
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.forest, fontWeight: 600 }}>
            Linked to pipeline
          </p>
          <a
            href={pipelineJobUrl(activity.job.id)}
            style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, fontWeight: 600 }}
          >
            {activity.job.role} @ {activity.job.company} →
          </a>
        </div>
      );
    }
    return null;
  }

  const company = activity.companyGuess ?? activity.job?.company ?? "this company";
  const role = activity.roleGuess ?? activity.job?.role ?? "this role";
  const hasGuess = Boolean(activity.companyGuess || activity.job);

  return (
    <div style={{ marginTop: compact ? 8 : 10 }}>
      {!activity.job && hasGuess && (
        <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.5 }}>
          Link this email to your pipeline?
          <br />
          <strong>{company}</strong>
          {role ? ` — ${role}` : ""}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {!activity.job && activity.companyGuess && (
          <ScoutPrimaryBtn onClick={() => onAction("accept", { createJob: true, applyStage: false })}>
            Add to pipeline
          </ScoutPrimaryBtn>
        )}
        {activity.suggestedStage && (
          <ScoutPrimaryBtn
            onClick={() =>
              onAction("accept", {
                createJob: !activity.job && Boolean(activity.companyGuess),
                applyStage: true,
              })
            }
          >
            {activity.job ? "Update" : "Add"} & mark {signalLabel(activity.suggestedStage)}
          </ScoutPrimaryBtn>
        )}
        {!activity.job && (
          <ScoutSecondaryBtn onClick={onToggleLink}>
            {linkOpen ? "Cancel link" : "Link existing job"}
          </ScoutSecondaryBtn>
        )}
        <ScoutSecondaryBtn onClick={() => onAction("dismiss")}>Not job-related</ScoutSecondaryBtn>
      </div>

      {linkOpen && (
        <select
          defaultValue=""
          onChange={(e) => {
            const jobId = e.target.value;
            if (jobId) onAction("link", { jobId });
          }}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "8px 10px",
            fontFamily: fontSans,
            fontSize: T.caption,
            border: border.line,
            borderRadius: "var(--scout-radius)",
          }}
        >
          <option value="">Select a pipeline role…</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.company} — {j.role}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

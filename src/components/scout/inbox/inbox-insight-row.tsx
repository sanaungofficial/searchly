"use client";

import { useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";
import { pipelineJobUrl } from "@/lib/workspace-urls";
import {
  insightHeadline,
  markStageLabel,
  MATCH_EXISTING_LABEL,
  NOT_JOB_EMAIL_LABEL,
  NOT_JOB_EMAIL_TOOLTIP,
  SAVE_ROLE_LABEL,
} from "@/lib/inbox-human-copy";
import type { ActivitySummary, PipelineJob } from "./inbox-types";
import { signalLabel } from "./inbox-types";

type ActivityLike = ActivitySummary | {
  id: string;
  signal: string;
  status: string;
  suggestedStage: string | null;
  title: string | null;
  snippet: string | null;
  companyGuess: string | null;
  roleGuess: string | null;
  confidence?: number | null;
  nylasMessageId?: string | null;
  job: { id: string; company: string; role: string; stage: string } | null;
};

type Props = {
  activity: ActivityLike;
  jobs: PipelineJob[];
  onOpenMail?: (messageId: string) => void;
  onAction: (
    action: "accept" | "dismiss" | "link",
    extra?: { jobId?: string; createJob?: boolean; applyStage?: boolean },
  ) => void | Promise<void>;
  compact?: boolean;
};

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <span title={NOT_JOB_EMAIL_TOOLTIP} style={{ display: "inline-flex" }}>
      <ScoutSecondaryBtn onClick={onClick}>{NOT_JOB_EMAIL_LABEL}</ScoutSecondaryBtn>
    </span>
  );
}

export function InboxInsightRow({ activity, jobs, onOpenMail, onAction, compact }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: "accept" | "dismiss" | "link", extra?: Parameters<Props["onAction"]>[1]) {
    setBusy(true);
    try {
      await onAction(action, extra);
    } finally {
      setBusy(false);
      setLinkOpen(false);
    }
  }

  const headline = insightHeadline(activity);

  if (activity.status !== "PENDING_REVIEW") {
    if (!activity.job) return null;
    return (
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          padding: compact ? "10px 0" : "12px 14px",
          borderBottom: compact ? "var(--scout-border)" : undefined,
          background: compact ? undefined : surface.card,
          border: compact ? undefined : "var(--scout-border)",
          borderRadius: compact ? undefined : "var(--scout-radius)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
            Linked to a role you&apos;re tracking
          </p>
          <a href={pipelineJobUrl(activity.job.id)} style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, fontWeight: 600 }}>
            {activity.job.role} at {activity.job.company} →
          </a>
        </div>
        {activity.nylasMessageId && onOpenMail && (
          <ScoutSecondaryBtn onClick={() => onOpenMail(activity.nylasMessageId!)}>Open email</ScoutSecondaryBtn>
        )}
      </div>
    );
  }

  const actionCol = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flexShrink: 0,
        minWidth: compact ? 128 : 148,
        alignItems: "stretch",
      }}
    >
      {activity.nylasMessageId && onOpenMail && (
        <ScoutSecondaryBtn onClick={() => onOpenMail(activity.nylasMessageId!)}>Open email</ScoutSecondaryBtn>
      )}
      {!activity.job && activity.companyGuess && (
        <ScoutPrimaryBtn disabled={busy} onClick={() => run("accept", { createJob: true, applyStage: false })}>
          {SAVE_ROLE_LABEL}
        </ScoutPrimaryBtn>
      )}
      {activity.suggestedStage && (
        <ScoutSecondaryBtn
          disabled={busy}
          onClick={() =>
            run("accept", {
              createJob: !activity.job && Boolean(activity.companyGuess),
              applyStage: true,
            })
          }
        >
          {markStageLabel(activity.suggestedStage)}
        </ScoutSecondaryBtn>
      )}
      {!activity.job && (
        <ScoutSecondaryBtn disabled={busy} onClick={() => setLinkOpen((v) => !v)}>
          {linkOpen ? "Cancel" : MATCH_EXISTING_LABEL}
        </ScoutSecondaryBtn>
      )}
      <DismissButton onClick={() => run("dismiss")} />
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        padding: compact ? "12px 0" : "14px 16px",
        borderBottom: "var(--scout-border)",
        background: compact ? undefined : "rgba(42,107,74,0.04)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <span
            style={{
              padding: "2px 8px",
              fontFamily: fontMono,
              fontSize: 10,
              fontWeight: 600,
              color: activity.job ? color.forest : "#8A6B2E",
              background: activity.job ? "rgba(42,107,74,0.12)" : "rgba(196,168,106,0.15)",
              borderRadius: 4,
            }}
          >
            {activity.job ? "Linked" : "New from email"}
          </span>
          <span style={{ fontFamily: fontMono, fontSize: 10, color: color.muted }}>
            {signalLabel(activity.signal)}
            {activity.confidence != null ? ` · ${Math.round(activity.confidence * 100)}%` : ""}
          </span>
        </div>
        <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
          {headline}
        </p>
        {activity.snippet && (
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.stone, lineHeight: 1.5 }}>
            {activity.snippet}
          </p>
        )}
        {linkOpen && (
          <select
            defaultValue=""
            onChange={(e) => {
              const jobId = e.target.value;
              if (jobId) run("link", { jobId });
            }}
            style={{
              marginTop: 10,
              width: "100%",
              maxWidth: 320,
              padding: "8px 10px",
              fontFamily: fontSans,
              fontSize: T.caption,
              border: "var(--scout-border)",
              borderRadius: "var(--scout-radius)",
            }}
          >
            <option value="">Choose a role you&apos;re tracking…</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.company} — {j.role}
              </option>
            ))}
          </select>
        )}
      </div>
      {actionCol}
    </div>
  );
}

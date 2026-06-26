"use client";

import { ScoutSecondaryBtn } from "../scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { InboxInsightRow } from "./inbox-insight-row";
import type { ActivitySummary, InboxLens, PipelineJob } from "./inbox-types";

const STRIP_LIMIT = 2;

type Props = {
  lens: InboxLens;
  insightsLoaded: boolean;
  insightsLoading: boolean;
  onCheckEmail: () => void;
  onViewAll: () => void;
  activities: ActivitySummary[];
  jobs: PipelineJob[];
  pendingCount: number;
  onOpenMail: (messageId: string) => void;
  onAction: (
    activity: ActivitySummary,
    action: "accept" | "dismiss" | "link",
    extra?: { jobId?: string; createJob?: boolean; applyStage?: boolean },
  ) => void | Promise<void>;
};

export function InboxInsightsStrip({
  lens,
  insightsLoaded,
  insightsLoading,
  onCheckEmail,
  onViewAll,
  activities,
  jobs,
  pendingCount,
  onOpenMail,
  onAction,
}: Props) {
  const title = lens === "work" ? "Work insights" : "Insights";
  const emailRows = insightsLoaded ? activities.slice(0, STRIP_LIMIT) : [];
  const hint =
    lens === "work"
      ? "Client and prospect updates — check when you're ready."
      : "Job search updates from your mail — check when you're ready.";

  return (
    <div style={{ borderBottom: border.line, background: surface.page, padding: "10px 16px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
          {title}
          {insightsLoaded && pendingCount > 0 ? ` (${pendingCount})` : ""}
        </p>
        <ScoutSecondaryBtn onClick={onCheckEmail} disabled={insightsLoading}>
          {insightsLoading ? "Checking…" : insightsLoaded ? "Check again" : "Check for updates"}
        </ScoutSecondaryBtn>
        <button
          type="button"
          onClick={onViewAll}
          style={{
            marginLeft: "auto",
            border: "none",
            background: "none",
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            color: color.forest,
            cursor: "pointer",
            padding: 0,
          }}
        >
          View all →
        </button>
      </div>

      {!insightsLoaded && (
        <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.5 }}>
          {hint} Tips live in View all.
        </p>
      )}

      {emailRows.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {emailRows.map((a) => (
            <InboxInsightRow
              key={a.id}
              activity={a}
              jobs={jobs}
              onOpenMail={onOpenMail}
              onAction={(action, extra) => onAction(a, action, extra)}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

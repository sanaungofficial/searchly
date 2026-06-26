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

  return (
    <div style={{ borderBottom: border.line, background: surface.page, padding: "8px 14px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
          {title}
          {insightsLoaded && pendingCount > 0 ? ` · ${pendingCount}` : ""}
        </span>
        <ScoutSecondaryBtn onClick={onCheckEmail} disabled={insightsLoading}>
          {insightsLoading ? "Checking…" : insightsLoaded ? "Check again" : "Check for updates"}
        </ScoutSecondaryBtn>
        {!insightsLoaded && (
          <span style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted }}>
            {lens === "work" ? "Client & prospect mail" : "Roles & follow-ups from your mail"}
          </span>
        )}
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

      {emailRows.length > 0 && (
        <div style={{ marginTop: 6 }}>
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

"use client";

import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { INSIGHTS_STRIP_TITLE } from "@/lib/inbox-human-copy";
import { pickWisdomTips } from "@/lib/inbox-wisdom-tips";
import { InboxInsightRow } from "./inbox-insight-row";
import { InboxWisdomTipRow } from "./inbox-wisdom-tip-row";
import type { ActivitySummary, PipelineJob } from "./inbox-types";

const STRIP_LIMIT = 3;
const STRIP_TIPS = 2;

type Props = {
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
  const stripTips = pickWisdomTips(STRIP_TIPS);
  const emailRows = insightsLoaded ? activities.slice(0, STRIP_LIMIT) : [];
  const showEmailRows = emailRows.length > 0;
  const showTips = !showEmailRows;

  return (
    <div style={{ borderBottom: border.line, background: surface.page }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px 0",
        }}
      >
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
          {INSIGHTS_STRIP_TITLE}
          {insightsLoaded && pendingCount > 0 ? ` (${pendingCount})` : ""}
        </p>
        <button
          type="button"
          onClick={onViewAll}
          style={{
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

      <div style={{ padding: "0 16px 8px" }}>
        {showEmailRows &&
          emailRows.map((a) => (
            <InboxInsightRow
              key={a.id}
              activity={a}
              jobs={jobs}
              onOpenMail={onOpenMail}
              onAction={(action, extra) => onAction(a, action, extra)}
              compact
            />
          ))}

        {showTips &&
          stripTips.map((tip) => <InboxWisdomTipRow key={tip.id} tip={tip} compact />)}

        <div style={{ padding: "10px 0 6px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {!insightsLoaded ? (
            <ScoutPrimaryBtn onClick={onCheckEmail} disabled={insightsLoading}>
              {insightsLoading ? "Checking…" : "Check email for updates"}
            </ScoutPrimaryBtn>
          ) : (
            <ScoutSecondaryBtn onClick={onCheckEmail} disabled={insightsLoading}>
              {insightsLoading ? "Checking…" : "Check again"}
            </ScoutSecondaryBtn>
          )}
          {insightsLoaded && pendingCount > STRIP_LIMIT && (
            <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
              {pendingCount - STRIP_LIMIT} more in View all
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import { INBOX_WISDOM_TIPS } from "@/lib/inbox-wisdom-tips";
import type { FollowUpSuggestion, InboxInsightsPayload } from "@/lib/inbox-insights-api";
import { pipelineJobUrl } from "@/lib/workspace-urls";
import { InboxInsightRow } from "./inbox-insight-row";
import { InboxWisdomTipRow } from "./inbox-wisdom-tip-row";
import type { ActivitySummary, PipelineJob } from "./inbox-types";

const DRAWER_WIDTH = 440;

type Props = {
  open: boolean;
  onClose: () => void;
  insightsLoaded: boolean;
  insightsLoading: boolean;
  onCheckEmail: () => void;
  activities: ActivitySummary[];
  jobs: PipelineJob[];
  followUps: FollowUpSuggestion[];
  onOpenMail: (messageId: string) => void;
  onAction: (
    activity: ActivitySummary,
    action: "accept" | "dismiss" | "link",
    extra?: { jobId?: string; createJob?: boolean; applyStage?: boolean },
  ) => void | Promise<void>;
};

export function InboxInsightsDrawer({
  open,
  onClose,
  insightsLoaded,
  insightsLoading,
  onCheckEmail,
  activities,
  jobs,
  followUps,
  onOpenMail,
  onAction,
}: Props) {
  const isMobile = useIsMobile();
  const tips = INBOX_WISDOM_TIPS;
  const tipsTitle = "Job search tips";
  const checkHint =
    "Check your email when you're ready — Kimchi will look for recruiters, interviews, and application updates. Nothing runs until you tap the button.";

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.18)",
          zIndex: 200,
          backdropFilter: isMobile ? "none" : "blur(1px)",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100%" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100%" : "calc(100vw - 16px)",
          background: surface.inset,
          border: isMobile ? "none" : "var(--scout-border)",
          zIndex: 201,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            padding: isMobile ? "14px 16px 12px" : "18px 20px 14px",
            borderBottom: "var(--scout-border)",
            background: surface.card,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontFamily: fontSans,
              fontSize: T.bodySm,
              color: color.forest,
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, flex: 1 }}>
            Insights & tips
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {!insightsLoaded && (
            <div style={{ padding: "16px 20px", borderBottom: "var(--scout-border)", background: "rgba(42,107,74,0.06)" }}>
              <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.55 }}>
                {checkHint}
              </p>
              <ScoutPrimaryBtn onClick={onCheckEmail} disabled={insightsLoading}>
                {insightsLoading ? "Checking…" : "Check email for updates"}
              </ScoutPrimaryBtn>
            </div>
          )}

          {insightsLoaded && activities.length === 0 && (
            <div style={{ padding: "14px 20px", borderBottom: "var(--scout-border)", background: "rgba(42,107,74,0.04)" }}>
              <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.55 }}>
                No new email updates right now. Tips below are still worth a skim.
              </p>
              <ScoutSecondaryBtn onClick={onCheckEmail} disabled={insightsLoading}>
                {insightsLoading ? "Checking…" : "Check again"}
              </ScoutSecondaryBtn>
            </div>
          )}

          {insightsLoaded && followUps.length > 0 && (
            <div style={{ padding: "16px 20px", borderBottom: "var(--scout-border)", background: "rgba(196,168,106,0.08)" }}>
              <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
                Follow-up ideas
              </p>
              {followUps.map((fu) => (
                <div key={fu.jobId} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderBottom: "var(--scout-border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink }}>
                      {fu.company} — {fu.role}
                    </p>
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.5 }}>
                      {fu.suggestion}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 120 }}>
                    <ScoutSecondaryBtn onClick={() => { window.location.href = pipelineJobUrl(fu.jobId); }}>
                      View role
                    </ScoutSecondaryBtn>
                    {fu.lastMessageId && (
                      <ScoutSecondaryBtn
                        onClick={() => {
                          onOpenMail(fu.lastMessageId!);
                          onClose();
                        }}
                      >
                        Open email
                      </ScoutSecondaryBtn>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {insightsLoaded && activities.length > 0 && (
            <div style={{ padding: "12px 20px 0" }}>
              <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
                From your email ({activities.length})
              </p>
              {activities.map((a) => (
                <InboxInsightRow
                  key={a.id}
                  activity={a}
                  jobs={jobs}
                  onOpenMail={(id) => {
                    onOpenMail(id);
                    onClose();
                  }}
                  onAction={(action, extra) => onAction(a, action, extra)}
                />
              ))}
            </div>
          )}

          <div style={{ padding: "16px 20px" }}>
            <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
              {tipsTitle}
            </p>
            {tips.map((tip) => (
              <InboxWisdomTipRow key={tip.id} tip={tip} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export type { InboxInsightsPayload };

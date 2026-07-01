"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { type KanbanCard } from "@/components/scout/workspace-data";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { SectionHeadingWithHelp } from "@/components/scout/section-help-tip";
import { SearchMetricsSections } from "@/components/scout/search-metrics-sections";
import {
  readOnboardingFinishPayload,
  type OnboardingFinishPayload,
} from "@/lib/onboarding-finish";
import type { SearchMetrics } from "@/lib/search-metrics";
import { bruddleHeadingStyle, color, fontSans, type as T } from "@/lib/typography";

type Props = {
  isMobile: boolean;
};

export function DashboardGetStarted({ isMobile }: Props) {
  const router = useRouter();
  const { kanbanCards, withClientReviewPath, withClientScope } = useWorkspace();
  const [finishPayload, setFinishPayload] = useState<OnboardingFinishPayload | null>(null);
  const [metrics, setMetrics] = useState<SearchMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    setFinishPayload(readOnboardingFinishPayload());
  }, []);

  useEffect(() => {
    setMetricsLoading(true);
    fetch(withClientScope("/api/user/search-metrics"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.jobs && data?.relationships) setMetrics(data as SearchMetrics);
      })
      .catch(() => {})
      .finally(() => setMetricsLoading(false));
  }, [withClientScope]);

  const pipelineTotal = useMemo(() => {
    if (metrics?.jobs) return metrics.jobs.activePipeline;
    return kanbanCards.filter((c) => c.stage !== "closed").length;
  }, [metrics, kanbanCards]);

  const finishJobLabel =
    finishPayload?.jobTitle &&
    `${finishPayload.jobTitle}${finishPayload.company ? ` @ ${finishPayload.company}` : ""}`;

  return (
    <div
      style={{
        borderTop: "var(--scout-border)",
        paddingTop: isMobile ? 24 : 32,
        paddingBottom: isMobile ? 24 : 32,
        marginTop: isMobile ? 8 : 0,
      }}
    >
      <SectionHeadingWithHelp
        title={pipelineTotal === 0 ? "Get started" : "Search progress"}
        help={
          pipelineTotal === 0
            ? "New here? These are the fastest ways to get moving — browse jobs, save one you're interested in, or upload your resume so we can actually help you tailor things."
            : "Job pipeline and networking lead counts — tap through to update roles or reach out to contacts."
        }
        titleStyle={{ fontSize: T.label, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, fontWeight: 600 }}
      />

      {finishPayload && (finishPayload.primaryAssetId || finishPayload.jobId || finishJobLabel) && (
        <ScoutBox
          padding={isMobile ? "16px 18px" : "18px 22px"}
          style={{
            marginTop: 12,
            marginBottom: 16,
            background: "rgba(74,139,106,0.06)",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            gap: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 6px" }}>
              {finishJobLabel ? "Pick up where you left off" : "Your resume is ready"}
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.55 }}>
              {finishJobLabel
                ? `You were looking at ${finishJobLabel}. Open it to see how you match, or save it to your list.`
                : "Open your resume to see how you stack up against a job description, or start tailoring it."}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8, flexShrink: 0 }}>
            {finishPayload.jobId && (
              <ScoutSecondaryBtn
                onClick={() => router.push(`/opportunities?job=${encodeURIComponent(finishPayload.jobId!)}`)}
                style={{ minHeight: 40, whiteSpace: "nowrap" }}
              >
                View role
              </ScoutSecondaryBtn>
            )}
            <ScoutPrimaryBtn
              onClick={() =>
                router.push(
                  withClientReviewPath(
                    finishPayload.primaryAssetId
                      ? "/profile/assets?open=primary"
                      : "/profile/assets",
                  ),
                )
              }
              style={{ minHeight: 40, whiteSpace: "nowrap" }}
            >
              {finishJobLabel ? "See how I match →" : "Open my resume →"}
            </ScoutPrimaryBtn>
          </div>
        </ScoutBox>
      )}

      {pipelineTotal === 0 && !metricsLoading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: isMobile ? 10 : 12,
            marginTop: 12,
          }}
        >
          {[
            {
              title: "Browse jobs",
              body: "See roles we've picked for you based on your profile — no need to start from scratch.",
              cta: "Browse jobs",
              onClick: () => router.push(withClientReviewPath("/opportunities")),
              primary: true,
            },
            {
              title: "Save a job",
              body: "Found something interesting? Save it here so you can track where you are in the process.",
              cta: "Go to my job list",
              onClick: () => router.push(withClientReviewPath("/opportunities")),
              primary: false,
            },
            {
              title: "Upload your resume",
              body: "We'll use it to suggest better-fit roles and help you tailor applications faster.",
              cta: "Upload resume",
              onClick: () => router.push(withClientReviewPath("/profile/assets")),
              primary: false,
            },
          ].map((card) => (
            <ScoutBox key={card.title} padding={isMobile ? "18px 16px" : "20px 20px"} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 6px" }}>
                  {card.title}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.55 }}>
                  {card.body}
                </p>
              </div>
              {card.primary ? (
                <ScoutPrimaryBtn onClick={card.onClick} style={{ minHeight: 40, width: "100%" }}>
                  {card.cta}
                </ScoutPrimaryBtn>
              ) : (
                <ScoutSecondaryBtn onClick={card.onClick} style={{ minHeight: 40, width: "100%" }}>
                  {card.cta}
                </ScoutSecondaryBtn>
              )}
            </ScoutBox>
          ))}
        </div>
      ) : (
        <SearchMetricsSections
          metrics={metrics}
          loading={metricsLoading}
          isMobile={isMobile}
          opportunitiesPath={withClientReviewPath("/opportunities")}
          networkingPath={withClientReviewPath("/networking")}
        />
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { SectionHeadingWithHelp } from "@/components/scout/section-help-tip";
import type { SearchMetrics } from "@/lib/search-metrics";
import { bruddleHeadingStyle, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

const STAT_LABEL: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: T.label,
  fontWeight: 600,
  color: color.muted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 10,
};

type Props = {
  metrics: SearchMetrics | null;
  loading?: boolean;
  isMobile: boolean;
  opportunitiesPath: string;
  networkingPath: string;
  /** When true, omit outer section headings (e.g. coach client drawer strip). */
  compact?: boolean;
};

function MetricCard({
  label,
  value,
  hint,
  isMobile,
}: {
  label: string;
  value: number;
  hint?: string;
  isMobile: boolean;
}) {
  return (
    <ScoutBox padding={isMobile ? "16px 18px" : "20px 24px"}>
      <p style={STAT_LABEL}>{label}</p>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: isMobile ? 36 : T.stat,
          fontWeight: 600,
          color: color.ink,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          margin: 0,
        }}
      >
        {value.toLocaleString()}
      </p>
      {hint && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 4, marginBottom: 0 }}>
          {hint}
        </p>
      )}
    </ScoutBox>
  );
}

export function SearchMetricsSections({
  metrics,
  loading,
  isMobile,
  opportunitiesPath,
  networkingPath,
  compact,
}: Props) {
  const router = useRouter();
  const statCardPad = isMobile ? "16px 18px" : "20px 24px";
  const jobs = metrics?.jobs;
  const rel = metrics?.relationships;

  const jobSection = (
    <>
      {!compact && (
        <SectionHeadingWithHelp
          title="Your job search"
          help="Pipeline counts from your saved roles — applied dates use the date you set (or when you moved to Applied)."
          titleStyle={{
            fontSize: T.label,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: color.muted,
            fontWeight: 600,
          }}
        />
      )}

      {loading && !metrics ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, marginTop: 12 }}>Loading metrics…</p>
      ) : jobs ? (
        <>
          <ScoutBox stack padding={statCardPad} style={{ marginTop: compact ? 0 : 12, marginBottom: 16 }}>
            <p style={STAT_LABEL}>Active pipeline</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
              <span style={displayTitleStyle(isMobile ? 40 : 48, { lineHeight: 1 })}>{jobs.activePipeline}</span>
              <span style={displayTitleStyle(20, { color: color.muted, lineHeight: 1.1 })}>roles</span>
            </div>
          </ScoutBox>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
              gap: isMobile ? 10 : 12,
              marginBottom: 16,
            }}
          >
            <MetricCard label="Applied (all time)" value={jobs.appliedLifetime} isMobile={isMobile} />
            <MetricCard label="Applied this week" value={jobs.appliedThisWeek} isMobile={isMobile} />
            <MetricCard label="Applied (7 days)" value={jobs.appliedLast7d} isMobile={isMobile} />
            <MetricCard label="Interviewing" value={jobs.interviewing} isMobile={isMobile} />
            <MetricCard label="Offers" value={jobs.offers} isMobile={isMobile} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
              gap: isMobile ? 10 : 12,
              marginBottom: compact ? 0 : 12,
            }}
          >
            {(
              [
                ["Saved", jobs.funnel.saved],
                ["Applied", jobs.funnel.applied],
                ["Interviewing", jobs.funnel.interview],
                ["Offer", jobs.funnel.offer],
              ] as const
            ).map(([label, count]) => (
              <MetricCard
                key={label}
                label={label}
                value={count}
                hint="In your pipeline now"
                isMobile={isMobile}
              />
            ))}
          </div>

          {!compact && (
            <div style={{ marginTop: 8, marginBottom: 20 }}>
              <ScoutSecondaryBtn onClick={() => router.push(opportunitiesPath)} style={{ minHeight: 40 }}>
                Open My opportunities →
              </ScoutSecondaryBtn>
            </div>
          )}
        </>
      ) : null}
    </>
  );

  const relSection = (
    <>
      {!compact && (
        <div style={{ marginTop: compact ? 0 : 8 }}>
          <SectionHeadingWithHelp
            title="Relationships"
            help="My Network contacts grouped by status — outreach and replies roll up to In conversation."
            titleStyle={{
              fontSize: T.label,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: color.muted,
              fontWeight: 600,
            }}
          />
        </div>
      )}

      {rel ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
              gap: isMobile ? 10 : 12,
              marginTop: compact ? 0 : 12,
              marginBottom: 12,
            }}
          >
            <MetricCard label="New" value={rel.new} isMobile={isMobile} />
            <MetricCard label="In conversation" value={rel.inConversation} isMobile={isMobile} />
            <MetricCard
              label="Meeting scheduled"
              value={rel.meetingScheduled}
              isMobile={isMobile}
            />
          </div>
          {rel.statusUpdatesLast7d > 0 && (
            <ScoutBox padding={isMobile ? "14px 16px" : "16px 20px"} style={{ marginBottom: 12, background: surface.inset }}>
              <ScoutLabel>Activity pulse</ScoutLabel>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, margin: "8px 0 0" }}>
                {rel.statusUpdatesLast7d} network status update{rel.statusUpdatesLast7d === 1 ? "" : "s"} in the last 7 days
              </p>
            </ScoutBox>
          )}
          {!compact && (
            <ScoutSecondaryBtn onClick={() => router.push(networkingPath)} style={{ minHeight: 40 }}>
              Open My Network →
            </ScoutSecondaryBtn>
          )}
        </>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div>
          <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 12px" }}>Job search</p>
          {jobSection}
        </div>
        <div>
          <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 12px" }}>Relationships</p>
          {relSection}
        </div>
      </div>
    );
  }

  return (
    <>
      {jobSection}
      <div style={{ borderTop: "var(--scout-border)", paddingTop: isMobile ? 24 : 28, marginTop: 8 }}>
        {relSection}
      </div>
    </>
  );
}

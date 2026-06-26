"use client";

import { FRESHNESS_COLORS, getJobFreshness, type JobFreshnessLevel } from "@/lib/job-posted-freshness";
import { fontSans, type as T } from "@/lib/typography";

type Props = {
  datePosted: string | null | undefined;
  /** compact = dot + short label; detail = includes apply hint */
  variant?: "compact" | "detail" | "dot-only";
  style?: React.CSSProperties;
};

export function JobFreshnessIndicator({ datePosted, variant = "compact", style }: Props) {
  const freshness = getJobFreshness(datePosted);
  const colors = FRESHNESS_COLORS[freshness.level];

  if (variant === "dot-only") {
    return (
      <span
        title={freshness.detailLabel}
        aria-label={freshness.cardLabel}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: colors.dot,
          flexShrink: 0,
          display: "inline-block",
          ...style,
        }}
      />
    );
  }

  return (
    <span
      title={freshness.detailLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: variant === "detail" ? "4px 10px" : "2px 0",
        borderRadius: variant === "detail" ? "var(--scout-radius)" : undefined,
        background: variant === "detail" ? colors.bg : "transparent",
        fontFamily: fontSans,
        fontSize: variant === "detail" ? T.caption : T.label,
        fontWeight: 600,
        color: colors.text,
        lineHeight: 1.35,
        ...style,
      }}
    >
      <FreshnessDot level={freshness.level} />
      <span>{freshness.cardLabel}</span>
    </span>
  );
}

function FreshnessDot({ level }: { level: JobFreshnessLevel }) {
  const colors = FRESHNESS_COLORS[level];
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors.dot,
        flexShrink: 0,
        boxShadow: level === "fresh" ? `0 0 0 2px ${colors.bg}` : undefined,
      }}
    />
  );
}

export function JobFreshnessLegend({ compact = false }: { compact?: boolean }) {
  const items: Array<{ level: JobFreshnessLevel; label: string }> = [
    { level: "fresh", label: compact ? "<24h" : "Posted in last 24 hours — apply now" },
    { level: "warm", label: compact ? "1–3 days" : "1–3 days old — still worth a shot" },
    { level: "stale", label: compact ? ">3 days" : "Older than 3 days — low response odds" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: compact ? 10 : 8, alignItems: "center" }}>
      {items.map(({ level, label }) => (
        <span
          key={level}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: fontSans,
            fontSize: compact ? T.label : T.caption,
            color: FRESHNESS_COLORS[level].text,
          }}
        >
          <FreshnessDot level={level} />
          {label}
        </span>
      ))}
    </div>
  );
}

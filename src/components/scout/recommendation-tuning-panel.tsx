"use client";

import {
  recommendationTuningGaps,
  recommendationTuningPct,
  type RecommendationTuningInput,
  type MatchingTuningGapId,
} from "@/lib/recommendation-tuning";
import { SectionHeadingWithHelp } from "@/components/scout/section-help-tip";
import { ScoutBox } from "@/components/scout/scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  input: RecommendationTuningInput;
  isMobile: boolean;
  onFixGap: (gapId: MatchingTuningGapId) => void;
};

export function RecommendationTuningPanel({ input, isMobile, onFixGap }: Props) {
  const pct = recommendationTuningPct(input);
  const gaps = recommendationTuningGaps(input);

  if (pct >= 100) return null;

  const barColor = pct >= 75 ? color.forest : pct >= 50 ? "#C4A86A" : "#C4574A";

  return (
    <ScoutBox padding={isMobile ? "16px 18px" : "18px 20px"}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <SectionHeadingWithHelp
          title="Help us match you better"
          help="We use what you tell us — target roles, location, salary, timeline, and goals — to sort jobs and coach suggestions. Fewer blanks means less noise and more stuff that's actually relevant to you."
        />
        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: barColor, flexShrink: 0 }}>
          {pct}% done
        </span>
      </div>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.55, margin: "0 0 12px" }}>
        A few quick answers go a long way. Tap anything below to fill in a gap.
      </p>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: surface.inset,
          border: "var(--scout-border)",
          overflow: "hidden",
          marginBottom: gaps.length ? 14 : 0,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: barColor,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      {gaps.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {gaps.slice(0, 4).map((gap) => (
            <button
              key={gap.id}
              type="button"
              onClick={() => onFixGap(gap.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                width: "100%",
                padding: "10px 12px",
                border: "var(--scout-border)",
                borderRadius: "var(--scout-radius)",
                background: surface.inset,
                cursor: "pointer",
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.ink,
                textAlign: "left",
              }}
            >
              <span>{gap.actionLabel}</span>
              <span style={{ color: color.forest, fontWeight: 600, flexShrink: 0 }}>Add →</span>
            </button>
          ))}
          {gaps.length > 4 && (
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: 0 }}>
              +{gaps.length - 4} more in Profile → Preferences
            </p>
          )}
        </div>
      )}
    </ScoutBox>
  );
}

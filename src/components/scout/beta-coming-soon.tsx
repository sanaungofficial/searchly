"use client";

import { ScoutBox, ScoutInsetBox } from "./scout-box";
import { WorkspacePageShell } from "./workspace-page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import { BETA_FEATURES, type BetaFeatureId } from "@/lib/beta-features";
import { border, color, fontSans, radius, surface, type as T } from "@/lib/typography";

export function BetaComingSoon({ feature }: { feature: BetaFeatureId }) {
  const isMobile = useIsMobile();
  const meta = BETA_FEATURES[feature];

  return (
    <WorkspacePageShell isMobile={isMobile} label={meta.label} title={meta.title}>
      <ScoutBox padding={isMobile ? "18px 16px" : "20px 22px"} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            padding: "6px 10px",
            background: "rgba(26,58,47,0.06)",
            border: border.line,
            borderRadius: radius.box,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              background: color.gold,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: color.forest,
            }}
          >
            In development
          </span>
        </div>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, lineHeight: 1.65, margin: 0, maxWidth: 520 }}>
          {meta.description}
        </p>
        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.caption,
            color: color.mutedLight,
            lineHeight: 1.55,
            margin: "14px 0 0",
          }}
        >
          We will email you when this is ready. For now, Dashboard, Opportunities, and Profile are fully available.
        </p>
      </ScoutBox>
      <ScoutInsetBox padding="14px 16px" style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.5 }}>
        Questions? Reply to any Kimchi email or reach out through your Second Ladder contact.
      </ScoutInsetBox>
    </WorkspacePageShell>
  );
}

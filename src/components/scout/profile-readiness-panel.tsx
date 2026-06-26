"use client";

import { profileReadiness, type ReadinessItem } from "@/lib/profile-readiness";
import type { ProfileSidebarTab } from "@/components/scout/profile-layout-sidebar";
import { ScoutBox } from "./scout-box";
import { fontSans, color, surface, border, type as T } from "@/lib/typography";

function StatusDot({ ready }: { ready: boolean }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: ready ? color.forest : "#C4A86A",
        flexShrink: 0,
      }}
    />
  );
}

export function ProfileReadinessPanel({
  resumeUrl,
  linkedinUrl,
  hasStrategy,
  linkedInScore,
  strategyFileCount,
  onNavigate,
  compact = false,
}: {
  resumeUrl?: string | null;
  linkedinUrl?: string | null;
  hasStrategy?: boolean;
  linkedInScore?: number | null;
  strategyFileCount?: number;
  onNavigate: (tab: ProfileSidebarTab) => void;
  compact?: boolean;
}) {
  const { items, overallPct } = profileReadiness({
    resumeUrl,
    linkedinUrl,
    hasStrategy,
    linkedInScore,
    strategyFileCount,
  });

  return (
    <ScoutBox padding={compact ? 14 : 18} style={{ marginBottom: compact ? 12 : 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
          Application readiness
        </p>
        <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 700, color: overallPct >= 100 ? color.forest : color.ink }}>
          {overallPct}%
        </span>
      </div>
      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 12px", lineHeight: 1.5 }}>
        Resume, LinkedIn, and strategy docs recruiters expect before you apply.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item) => (
          <ReadinessRow key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </ScoutBox>
  );
}

function ReadinessRow({
  item,
  onNavigate,
}: {
  item: ReadinessItem;
  onNavigate: (tab: ProfileSidebarTab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.tab)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 12px",
        border: border.line,
        background: item.ready ? "rgba(26,58,47,0.04)" : surface.card,
        cursor: "pointer",
        textAlign: "left",
        borderRadius: "var(--scout-radius)",
      }}
    >
      <StatusDot ready={item.ready} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink, margin: 0 }}>{item.label}</p>
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "2px 0 0", lineHeight: 1.4 }}>{item.detail}</p>
      </div>
      <span style={{ fontFamily: fontSans, fontSize: 12, color: color.forest, flexShrink: 0 }}>Open →</span>
    </button>
  );
}

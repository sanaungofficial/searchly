"use client";

import { fontMono, color } from "@/lib/typography";

export function InternalCoachBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: fontMono,
        fontSize: compact ? 10 : 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: compact ? "2px 6px" : "3px 8px",
        background: "rgba(26,58,47,0.08)",
        color: color.forest,
        borderRadius: "var(--scout-radius)",
      }}
    >
      Second Ladder coach
    </span>
  );
}

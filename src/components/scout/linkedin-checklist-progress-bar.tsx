"use client";

import { linkedInChecklistProgress, type ChecklistProgressItem } from "@/lib/linkedin-checklist-progress";
import type { LinkedInProfileDraft } from "@/lib/linkedin-profile";
import { fontSans, color, surface, border } from "@/lib/typography";

export function LinkedInChecklistProgressBar({
  draft,
  onJump,
}: {
  draft: LinkedInProfileDraft;
  onJump?: (item: ChecklistProgressItem) => void;
}) {
  const { optimizedCount, totalCount, nextWeak } = linkedInChecklistProgress(draft);
  const pct = totalCount ? Math.round((optimizedCount / totalCount) * 100) : 0;

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "12px 14px",
        border: border.line,
        background: surface.inset,
        borderRadius: "var(--scout-radius)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.ink, margin: 0 }}>
          {optimizedCount} of {totalCount} sections ready for LinkedIn
        </p>
        <span style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 700, color: pct >= 80 ? color.forest : "#92400e" }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 6, background: surface.card, border: border.line, overflow: "hidden", marginBottom: nextWeak ? 10 : 0 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? color.forest : "#C4A86A", transition: "width 0.3s ease" }} />
      </div>
      {nextWeak && onJump && (
        <button
          type="button"
          onClick={() => onJump(nextWeak)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: fontSans,
            fontSize: 12,
            color: color.forest,
            textDecoration: "underline",
            textAlign: "left",
          }}
        >
          Next: improve {nextWeak.label} →
        </button>
      )}
    </div>
  );
}

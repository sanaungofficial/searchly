"use client";

import type { DashboardGoal } from "@/lib/dashboard-goals";
import {
  dashboardGoalCategoryLabel,
  formatGoalTargetDate,
} from "@/lib/dashboard-goals";
import { ScoutSecondaryBtn, scoutFieldStyle, scoutInsetChipStyle } from "@/components/scout/scout-box";
import { color, fontSans, type as T } from "@/lib/typography";

type Props = {
  goal: DashboardGoal;
  saving: boolean;
  isMobile: boolean;
  isEditingTarget: boolean;
  editTargetMonth: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditMonthChange: (value: string) => void;
  onSaveTarget: () => void;
  onRemove: () => void;
  /** Omit bottom border on last item in a list */
  isLast?: boolean;
};

export function DashboardGoalItem({
  goal,
  saving,
  isMobile,
  isEditingTarget,
  editTargetMonth,
  onStartEdit,
  onCancelEdit,
  onEditMonthChange,
  onSaveTarget,
  onRemove,
  isLast = false,
}: Props) {
  const targetLabel = formatGoalTargetDate(goal.targetDate);

  return (
    <div
      style={{
        borderBottom: isLast ? "none" : "var(--scout-border)",
        paddingBottom: isLast ? 0 : 12,
      }}
    >
      {targetLabel && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 4px" }}>
          {targetLabel}
        </p>
      )}
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.bodySm,
          fontWeight: 600,
          color: color.ink,
          margin: "0 0 8px",
          lineHeight: 1.4,
        }}
      >
        {goal.label}
      </p>
      {goal.followUpNote && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px", lineHeight: 1.45 }}>
          {goal.followUpNote}
        </p>
      )}
      {isEditingTarget && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <input
            type="month"
            value={editTargetMonth}
            onChange={(e) => onEditMonthChange(e.target.value)}
            style={{
              ...scoutFieldStyle,
              flex: 1,
              minWidth: 140,
              padding: "8px 10px",
              fontSize: isMobile ? 16 : T.bodySm,
            }}
          />
          <ScoutSecondaryBtn onClick={onSaveTarget} disabled={saving} style={{ minHeight: 36 }}>
            Save
          </ScoutSecondaryBtn>
          <button
            type="button"
            onClick={onCancelEdit}
            style={{
              background: "none",
              border: "none",
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={scoutInsetChipStyle}>{dashboardGoalCategoryLabel(goal.category)}</span>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={onStartEdit}
            disabled={saving}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.forest,
              cursor: saving ? "default" : "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              cursor: saving ? "default" : "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

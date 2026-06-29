"use client";

import { useEffect, useState } from "react";
import type { DashboardGoal } from "@/lib/dashboard-goals";
import { DASHBOARD_GOAL_MAX } from "@/lib/dashboard-goals";
import { DashboardGoalItem } from "@/components/scout/dashboard-goal-item";
import { ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";
import { bruddleHeadingStyle, color, fontSans, surface, type as T } from "@/lib/typography";

const line = "var(--scout-border)";

type Props = {
  open: boolean;
  goals: DashboardGoal[];
  saving: boolean;
  canAdd: boolean;
  editingTargetId: string | null;
  editTargetMonth: string;
  onClose: () => void;
  onAddGoal: () => void;
  onStartEdit: (id: string, month: string) => void;
  onCancelEdit: () => void;
  onEditMonthChange: (value: string) => void;
  onSaveTarget: (id: string) => void;
  onRemove: (id: string) => void;
};

export function DashboardGoalsDrawer({
  open,
  goals,
  saving,
  canAdd,
  editingTargetId,
  editTargetMonth,
  onClose,
  onAddGoal,
  onStartEdit,
  onCancelEdit,
  onEditMonthChange,
  onSaveTarget,
  onRemove,
}: Props) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  return (
    <>
      <div
        onClick={close}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: DRAWER_BACKDROP_Z }}
      />
      <aside
        className="bruddle"
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          width: isMobile ? "100vw" : "min(440px, calc(100vw - 16px))",
          background: surface.card,
          border: isMobile ? "none" : line,
          zIndex: DRAWER_Z,
          display: "flex",
          flexDirection: "column",
          boxShadow: isMobile ? "none" : "-4px 4px 0 #161616",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
        }}
      >
        <div
          style={{
            padding: isMobile ? "14px 16px" : "16px 20px",
            borderBottom: line,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 24,
              color: color.mutedLight,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...bruddleHeadingStyle("h5"), margin: 0 }}>Your goals</p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "2px 0 0" }}>
              Up to {DASHBOARD_GOAL_MAX} active goals
            </p>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isMobile ? "16px" : "18px 20px" }}>
          {goals.length === 0 ? (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: 0 }}>
              No goals yet — add one to personalize your dashboard.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {goals.map((goal, index) => (
                <DashboardGoalItem
                  key={goal.id}
                  goal={goal}
                  saving={saving}
                  isMobile={isMobile}
                  isEditingTarget={editingTargetId === goal.id}
                  editTargetMonth={editTargetMonth}
                  onStartEdit={() => onStartEdit(goal.id, goal.targetDate ?? "")}
                  onCancelEdit={onCancelEdit}
                  onEditMonthChange={onEditMonthChange}
                  onSaveTarget={() => onSaveTarget(goal.id)}
                  onRemove={() => onRemove(goal.id)}
                  isLast={index === goals.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {canAdd && (
          <div style={{ padding: isMobile ? "14px 16px" : "16px 20px", borderTop: line, flexShrink: 0 }}>
            <ScoutPrimaryBtn
              onClick={() => {
                close();
                onAddGoal();
              }}
              style={{ width: "100%", minHeight: 42 }}
            >
              Add a goal
            </ScoutPrimaryBtn>
          </div>
        )}
      </aside>
    </>
  );
}

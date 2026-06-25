"use client";

import { useEffect } from "react";
import {
  DASHBOARD_GOAL_OPTIONS,
  dashboardGoalCategoryLabel,
  type DashboardGoalOption,
} from "@/lib/dashboard-goals";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  open: boolean;
  onClose: () => void;
  pickValue: string;
  onPickValueChange: (value: string) => void;
  pickTargetMonth: string;
  onPickTargetMonthChange: (value: string) => void;
  availableOptions: DashboardGoalOption[];
  saving: boolean;
  onSave: () => void;
};

export function DashboardAddGoalModal({
  open,
  onClose,
  pickValue,
  onPickValueChange,
  pickTargetMonth,
  onPickTargetMonthChange,
  availableOptions,
  saving,
  onSave,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectedLabel = availableOptions.find((o) => o.value === pickValue)?.label ?? "Add goal";

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300 }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 301,
          padding: 16,
          pointerEvents: "none",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-goal-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: "auto",
            background: surface.card,
            border: border.lineStrong,
            width: "100%",
            maxWidth: 480,
            padding: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <h2 id="add-goal-title" style={{ ...displayTitleStyle(22), margin: 0 }}>
              {pickValue ? selectedLabel : "Add goal"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ background: "none", border: "none", fontSize: 22, color: color.muted, cursor: "pointer", lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>

          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 20px", lineHeight: 1.55 }}>
            Choose an outcome you&apos;re working toward. You can add a target month if you have one in mind.
          </p>

          <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, color: color.muted, marginBottom: 6 }}>
            Outcome
          </label>
          <select
            value={pickValue}
            onChange={(e) => onPickValueChange(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 10px",
              border: border.line,
              background: surface.card,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              color: color.ink,
              marginBottom: 16,
              boxSizing: "border-box",
            }}
          >
            <option value="">Choose an outcome…</option>
            {(["job_search", "coaching", "career"] as const).map((cat) => {
              const opts = availableOptions.filter((o) => o.category === cat);
              if (opts.length === 0) return null;
              return (
                <optgroup key={cat} label={dashboardGoalCategoryLabel(cat)}>
                  {opts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>

          <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, color: color.muted, marginBottom: 6 }}>
            Target date (optional)
          </label>
          <input
            type="month"
            value={pickTargetMonth}
            onChange={(e) => onPickTargetMonthChange(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 10px",
              border: border.line,
              background: surface.card,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              color: color.ink,
              marginBottom: 24,
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <ScoutSecondaryBtn onClick={onClose} disabled={saving} style={{ minHeight: 40 }}>
              Cancel
            </ScoutSecondaryBtn>
            <ScoutPrimaryBtn onClick={onSave} disabled={!pickValue || saving} style={{ minHeight: 40 }}>
              {saving ? "Saving…" : "Save goal"}
            </ScoutPrimaryBtn>
          </div>
        </div>
      </div>
    </>
  );
}

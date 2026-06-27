"use client";

import {
  dashboardGoalCategoryLabel,
  type DashboardGoalOption,
} from "@/lib/dashboard-goals";
import { ScoutModal } from "@/components/scout/scout-modal";
import { ScoutPrimaryBtn, ScoutSecondaryBtn, scoutFieldStyle } from "@/components/scout/scout-box";
import { color, displayTitleStyle, fontSans, type as T } from "@/lib/typography";

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
  const selectedLabel = availableOptions.find((o) => o.value === pickValue)?.label ?? "Add goal";

  return (
    <ScoutModal open={open} onClose={onClose} ariaLabelledBy="add-goal-title" maxWidth={480}>
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
        Choose what you&apos;re working toward. Add a target month if you have one.
      </p>

      <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, color: color.muted, marginBottom: 6 }}>
        Outcome
      </label>
      <select
        value={pickValue}
        onChange={(e) => onPickValueChange(e.target.value)}
        style={{ ...scoutFieldStyle, marginBottom: 16 }}
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
        style={{ ...scoutFieldStyle, marginBottom: 24 }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <ScoutSecondaryBtn onClick={onClose} disabled={saving} style={{ minHeight: 40 }}>
          Cancel
        </ScoutSecondaryBtn>
        <ScoutPrimaryBtn onClick={onSave} disabled={!pickValue || saving} style={{ minHeight: 40 }}>
          {saving ? "Saving…" : "Save goal"}
        </ScoutPrimaryBtn>
      </div>
    </ScoutModal>
  );
}

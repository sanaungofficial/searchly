"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GOAL_WIZARD_CATEGORIES,
  goalOptionsForCategory,
  type DashboardGoal,
  type DashboardGoalCategory,
  type DashboardGoalOption,
} from "@/lib/dashboard-goals";
import { dismissGoalsWizard } from "@/lib/recommendation-tuning";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

type WizardStep = "intro" | "category" | "subcategory" | "targetMonth";

type Props = {
  open: boolean;
  showIntro: boolean;
  onClose: () => void;
  onSave: (goal: Omit<DashboardGoal, "id" | "createdAt">) => void | Promise<void>;
  availableOptions: DashboardGoalOption[];
  saving: boolean;
};

function WizardProgress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 5, marginBottom: 20 }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 2,
            borderRadius: 1,
            background: step >= i ? color.forest : "rgba(26,58,47,0.15)",
            transition: "background 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

export function DashboardGoalWizardModal({
  open,
  showIntro,
  onClose,
  onSave,
  availableOptions,
  saving,
}: Props) {
  const [step, setStep] = useState<WizardStep>(showIntro ? "intro" : "category");
  const [category, setCategory] = useState<DashboardGoalCategory | "">("");
  const [pickValue, setPickValue] = useState("");
  const [targetMonth, setTargetMonth] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(showIntro ? "intro" : "category");
    setCategory("");
    setPickValue("");
    setTargetMonth("");
    setSearch("");
  }, [open, showIntro]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const subcategoryOptions = useMemo(() => {
    if (!category) return [];
    const opts = goalOptionsForCategory(category).filter((o) =>
      availableOptions.some((a) => a.value === o.value),
    );
    const q = search.trim().toLowerCase();
    if (!q) return opts;
    return opts.filter((o) => o.label.toLowerCase().includes(q));
  }, [category, availableOptions, search]);

  const selectedOption = availableOptions.find((o) => o.value === pickValue);

  const progressIndex =
    step === "intro" ? 0 : step === "category" ? 1 : step === "subcategory" ? 2 : 3;
  const progressTotal = showIntro ? 4 : 3;

  const finish = async (month: string) => {
    if (!selectedOption) return;
    await onSave({
      category: selectedOption.category,
      value: selectedOption.value,
      label: selectedOption.label,
      ...(month.trim() ? { targetDate: month.trim().slice(0, 7) } : {}),
    });
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300 }} />
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
          aria-labelledby="goal-wizard-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: "auto",
            background: surface.card,
            border: "var(--scout-border)",
            width: "100%",
            maxWidth: 520,
            maxHeight: "min(90vh, 640px)",
            overflow: "auto",
            padding: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
            <h2 id="goal-wizard-title" style={{ ...displayTitleStyle(22), margin: 0 }}>
              {step === "intro" ? "Add a goal" : selectedOption?.label ?? "Add a goal"}
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

          {step !== "intro" && <WizardProgress step={progressIndex} total={progressTotal} />}

          {step === "intro" && (
            <>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: "0 0 24px" }}>
                This helps us match you with the right jobs and coaches. Pick one primary goal — you can add more later from your dashboard.
              </p>
              <ScoutPrimaryBtn
                onClick={() => setStep("category")}
                style={{ width: "100%", minHeight: 44, marginBottom: 12 }}
              >
                Get started
              </ScoutPrimaryBtn>
              <button
                type="button"
                onClick={() => {
                  dismissGoalsWizard();
                  onClose();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  background: "none",
                  border: "none",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.muted,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                  padding: "8px 0",
                }}
              >
                Skip for now
              </button>
            </>
          )}

          {step === "category" && (
            <>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 16px", lineHeight: 1.55 }}>
                What are you trying to achieve?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {GOAL_WIZARD_CATEGORIES.map((cat) => {
                  const hasOpts = goalOptionsForCategory(cat.id).some((o) =>
                    availableOptions.some((a) => a.value === o.value),
                  );
                  if (!hasOpts) return null;
                  const selected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategory(cat.id);
                        setPickValue("");
                        setSearch("");
                        setStep("subcategory");
                      }}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        border: selected ? `1.5px solid ${color.forest}` : "var(--scout-border)",
                        borderRadius: "var(--scout-radius)",
                        background: selected ? "rgba(74,139,106,0.1)" : surface.inset,
                        cursor: "pointer",
                        fontFamily: fontSans,
                      }}
                    >
                      <span style={{ display: "block", fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>{cat.title}</span>
                      <span style={{ display: "block", fontSize: T.caption, color: color.muted, marginTop: 4, lineHeight: 1.45 }}>
                        {cat.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              <ScoutSecondaryBtn onClick={() => (showIntro ? setStep("intro") : onClose())} style={{ minHeight: 40 }}>
                ← Back
              </ScoutSecondaryBtn>
            </>
          )}

          {step === "subcategory" && category && (
            <>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 12px", lineHeight: 1.55 }}>
                Pick the outcome that fits best.
              </p>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "var(--scout-border)",
                  borderRadius: "var(--scout-radius)",
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  marginBottom: 12,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, maxHeight: 240, overflow: "auto" }}>
                {subcategoryOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setPickValue(opt.value);
                      setStep("targetMonth");
                    }}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      border: pickValue === opt.value ? `1.5px solid ${color.forest}` : "var(--scout-border)",
                      borderRadius: "var(--scout-radius)",
                      background: pickValue === opt.value ? "rgba(74,139,106,0.1)" : surface.card,
                      cursor: "pointer",
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      color: color.ink,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                {subcategoryOptions.length === 0 && (
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>No matches — try another category.</p>
                )}
              </div>
              <ScoutSecondaryBtn onClick={() => setStep("category")} style={{ minHeight: 40 }}>
                ← Back
              </ScoutSecondaryBtn>
            </>
          )}

          {step === "targetMonth" && selectedOption && (
            <>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 16px", lineHeight: 1.55 }}>
                When do you want to achieve this? Optional — helps us prioritize coaches and timelines.
              </p>
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "var(--scout-border)",
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  marginBottom: 20,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ScoutPrimaryBtn
                  onClick={() => void finish(targetMonth)}
                  disabled={saving}
                  style={{ minHeight: 44 }}
                >
                  {saving ? "Saving…" : "Save goal"}
                </ScoutPrimaryBtn>
                <ScoutSecondaryBtn onClick={() => void finish("")} disabled={saving} style={{ minHeight: 40 }}>
                  Skip this step
                </ScoutSecondaryBtn>
                <ScoutSecondaryBtn onClick={() => setStep("subcategory")} disabled={saving} style={{ minHeight: 40 }}>
                  ← Back
                </ScoutSecondaryBtn>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

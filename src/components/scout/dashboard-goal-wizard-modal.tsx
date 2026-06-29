"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GOAL_WIZARD_ENTRIES,
  GOALS_MATCHING_TAGLINE,
  getGoalFollowUp,
  goalOptionsForWizardEntry,
  rankGoalOptionsForProfile,
  rankWizardEntries,
  type DashboardGoal,
  type GoalProfileContext,
  type GoalWizardEntry,
  wizardEntryDisplay,
} from "@/lib/dashboard-goals";
import { dismissGoalsWizard } from "@/lib/recommendation-tuning";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

type WizardStep = "intro" | "category" | "subcategory" | "followUp" | "targetMonth";

type Props = {
  open: boolean;
  showIntro: boolean;
  onClose: () => void;
  onSave: (goal: Omit<DashboardGoal, "id" | "createdAt">) => void | Promise<void>;
  availableValues: Set<string>;
  profileContext: GoalProfileContext;
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
  availableValues,
  profileContext,
  saving,
}: Props) {
  const [step, setStep] = useState<WizardStep>(showIntro ? "intro" : "category");
  const [wizardEntry, setWizardEntry] = useState<GoalWizardEntry | null>(null);
  const [pickValue, setPickValue] = useState("");
  const [followUpChoice, setFollowUpChoice] = useState("");
  const [targetMonth, setTargetMonth] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep(showIntro ? "intro" : "category");
    setWizardEntry(null);
    setPickValue("");
    setFollowUpChoice("");
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

  const rankedEntries = useMemo(
    () => rankWizardEntries(GOAL_WIZARD_ENTRIES, profileContext, availableValues),
    [profileContext, availableValues],
  );

  const subcategoryOptions = useMemo(() => {
    if (!wizardEntry) return [];
    const opts = rankGoalOptionsForProfile(
      goalOptionsForWizardEntry(wizardEntry, availableValues),
      profileContext,
    );
    const q = search.trim().toLowerCase();
    if (!q) return opts;
    return opts.filter((o) => o.label.toLowerCase().includes(q));
  }, [wizardEntry, availableValues, profileContext, search]);

  const selectedOption = pickValue
    ? subcategoryOptions.find((o) => o.value === pickValue) ??
      goalOptionsForWizardEntry(wizardEntry ?? GOAL_WIZARD_ENTRIES[0], availableValues).find(
        (o) => o.value === pickValue,
      )
    : undefined;

  const followUp = pickValue ? getGoalFollowUp(pickValue, profileContext) : null;

  const progressIndex =
    step === "intro"
      ? 0
      : step === "category"
        ? 1
        : step === "subcategory"
          ? 2
          : step === "followUp"
            ? 3
            : followUp
              ? 4
              : 3;
  const progressTotal = showIntro ? (followUp ? 5 : 4) : followUp ? 4 : 3;

  const goAfterSubcategory = (value: string) => {
    setPickValue(value);
    const nextFollowUp = getGoalFollowUp(value, profileContext);
    setStep(nextFollowUp ? "followUp" : "targetMonth");
  };

  const finish = async (month: string) => {
    if (!selectedOption) return;
    const followUpNote = followUp && followUpChoice
      ? followUp.choices.find((c) => c.value === followUpChoice)?.label ?? followUpChoice
      : null;
    await onSave({
      category: selectedOption.category,
      value: selectedOption.value,
      label: selectedOption.label,
      ...(month.trim() ? { targetDate: month.trim().slice(0, 7) } : {}),
      ...(followUpNote ? { followUpNote } : {}),
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
          className="bruddle"
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
                {GOALS_MATCHING_TAGLINE} Pick one primary goal — you can add more later from your dashboard.
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
                What kind of match are you looking for?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {rankedEntries.map((entry) => {
                  const display = wizardEntryDisplay(entry, profileContext);
                  const selected = wizardEntry?.key === entry.key;
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => {
                        setWizardEntry(entry);
                        setPickValue("");
                        setFollowUpChoice("");
                        setSearch("");
                        setStep("subcategory");
                      }}
                      style={{
                        textAlign: "left",
                        padding: "14px 16px",
                        border: selected ? `1.5px solid ${color.forest}` : "var(--scout-border)",
                        borderRadius: "var(--scout-radius)",
                        background: display.suggested ? "rgba(74,139,106,0.12)" : selected ? "rgba(74,139,106,0.1)" : surface.inset,
                        cursor: "pointer",
                        fontFamily: fontSans,
                      }}
                    >
                      {display.suggested && (
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: T.label,
                            fontWeight: 700,
                            color: color.forest,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            marginBottom: 4,
                          }}
                        >
                          Suggested for you
                        </span>
                      )}
                      <span style={{ display: "block", fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>{display.title}</span>
                      <span style={{ display: "block", fontSize: T.caption, color: color.muted, marginTop: 4, lineHeight: 1.45 }}>
                        {display.description}
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

          {step === "subcategory" && wizardEntry && (
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
                {subcategoryOptions.map((opt, index) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => goAfterSubcategory(opt.value)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      border: pickValue === opt.value ? `1.5px solid ${color.forest}` : "var(--scout-border)",
                      borderRadius: "var(--scout-radius)",
                      background: index === 0 && subcategoryOptions.length > 1 ? "rgba(74,139,106,0.08)" : surface.card,
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

          {step === "followUp" && followUp && selectedOption && (
            <>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 16px", lineHeight: 1.55 }}>
                {followUp.prompt}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {followUp.choices.map((choice) => {
                  const selected = followUpChoice === choice.value;
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => setFollowUpChoice(choice.value)}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        border: selected ? `1.5px solid ${color.forest}` : "var(--scout-border)",
                        borderRadius: "var(--scout-radius)",
                        background: selected ? "rgba(74,139,106,0.1)" : surface.card,
                        cursor: "pointer",
                        fontFamily: fontSans,
                        fontSize: T.bodySm,
                        color: color.ink,
                      }}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ScoutPrimaryBtn
                  onClick={() => setStep("targetMonth")}
                  disabled={!followUp.optional && !followUpChoice}
                  style={{ minHeight: 44 }}
                >
                  Continue
                </ScoutPrimaryBtn>
                {followUp.optional && (
                  <ScoutSecondaryBtn
                    onClick={() => {
                      setFollowUpChoice("");
                      setStep("targetMonth");
                    }}
                    style={{ minHeight: 40 }}
                  >
                    Skip this step
                  </ScoutSecondaryBtn>
                )}
                <ScoutSecondaryBtn onClick={() => setStep("subcategory")} style={{ minHeight: 40 }}>
                  ← Back
                </ScoutSecondaryBtn>
              </div>
            </>
          )}

          {step === "targetMonth" && selectedOption && (
            <>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 16px", lineHeight: 1.55 }}>
                When do you want to achieve this? Optional — helps us prioritize matches and timelines.
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
                <ScoutSecondaryBtn
                  onClick={() => setStep(followUp ? "followUp" : "subcategory")}
                  disabled={saving}
                  style={{ minHeight: 40 }}
                >
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

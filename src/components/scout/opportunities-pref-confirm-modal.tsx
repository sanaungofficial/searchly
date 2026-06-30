"use client";

import { useEffect, useMemo, useState } from "react";
import { JobFunctionPicker } from "@/components/scout/job-function-picker";
import {
  JOBRIGHT_EXPERIENCE_LEVELS,
  type SearchPreferences,
} from "@/lib/search-preferences";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

const LS_KEY_PREFIX = "kimchi:opportunities-pref-confirm:";

export function opportunitiesPrefConfirmStorageKey(userId: string | null | undefined): string {
  return `${LS_KEY_PREFIX}${userId ?? "anonymous"}`;
}

export function readOpportunitiesPrefDismissed(userId: string | null | undefined): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(opportunitiesPrefConfirmStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markOpportunitiesPrefDismissed(userId: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(opportunitiesPrefConfirmStorageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export type OpportunitiesPrefConfirmInput = {
  targetRoles: string[];
  prioritizedCategories: string[];
  suggestedCategories?: string[];
  experienceLevelLabels?: string[];
  roleMatchCount?: number;
};

type Props = {
  open: boolean;
  userId: string | null;
  input: OpportunitiesPrefConfirmInput;
  onClose: () => void;
  onConfirm: (patch: {
    prioritizedCategories: string[];
    searchPreferences: Partial<SearchPreferences>;
  }) => Promise<void>;
};

export function OpportunitiesPrefConfirmModal({ open, userId, input, onClose, onConfirm }: Props) {
  const [categories, setCategories] = useState<string[]>(input.prioritizedCategories);
  const [experienceLabels, setExperienceLabels] = useState<string[]>(
    input.experienceLevelLabels ?? [],
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategories(input.prioritizedCategories);
      setExperienceLabels(input.experienceLevelLabels ?? []);
    }
  }, [open, input.prioritizedCategories, input.experienceLevelLabels]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const roleCount = input.roleMatchCount ?? input.targetRoles.length;

  const toggleExperience = (label: string) => {
    setExperienceLabels((prev) =>
      prev.some((l) => l.toLowerCase() === label.toLowerCase())
        ? prev.filter((l) => l.toLowerCase() !== label.toLowerCase())
        : [...prev, label],
    );
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm({
        prioritizedCategories: categories,
        searchPreferences: {
          experienceLevelLabels: experienceLabels,
          opportunitiesPrefConfirmedAt: new Date().toISOString(),
        },
      });
      markOpportunitiesPrefDismissed(userId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300 }} />
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
          aria-labelledby="opp-pref-confirm-title"
          className="bruddle"
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: "auto",
            background: surface.card,
            border: "var(--scout-border)",
            width: "100%",
            maxWidth: 520,
            maxHeight: "min(90vh, 680px)",
            overflowY: "auto",
            padding: 24,
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          }}
        >
          <h2 id="opp-pref-confirm-title" style={{ ...displayTitleStyle(22), margin: "0 0 8px" }}>
            We found {roleCount > 0 ? roleCount : "several"} role{roleCount === 1 ? "" : "s"} that fit you best
          </h2>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 20px", lineHeight: 1.55 }}>
            Confirm your job functions and experience levels so we can personalize your feed. You can change these anytime under Profile.
          </p>

          <section style={{ marginBottom: 20 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Recommended experience levels
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {JOBRIGHT_EXPERIENCE_LEVELS.map(({ label }) => {
                const checked = experienceLabels.some((l) => l.toLowerCase() === label.toLowerCase());
                return (
                  <label
                    key={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      border: checked ? `1.5px solid ${color.forest}` : "var(--scout-border)",
                      borderRadius: "var(--scout-radius)",
                      background: checked ? "rgba(74,139,106,0.08)" : surface.inset,
                      cursor: "pointer",
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleExperience(label)} />
                    {label}
                  </label>
                );
              })}
            </div>
          </section>

          <section style={{ marginBottom: 24 }}>
            <JobFunctionPicker
              selected={categories}
              onChange={setCategories}
              variant="profile"
              fullWidth
            />
          </section>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <ScoutSecondaryBtn onClick={onClose} disabled={saving}>
              Not now
            </ScoutSecondaryBtn>
            <ScoutPrimaryBtn onClick={() => void handleConfirm()} disabled={saving}>
              {saving ? "Saving…" : "Confirm & see jobs"}
            </ScoutPrimaryBtn>
          </div>
        </div>
      </div>
    </>
  );
}

/** Whether to show the first-visit confirm modal. */
export function shouldShowOpportunitiesPrefConfirm(input: {
  userId: string | null;
  targetRoles: string[];
  prioritizedCategories: string[];
  searchPreferences: SearchPreferences;
  onboardingJustFinished?: boolean;
}): boolean {
  if (readOpportunitiesPrefDismissed(input.userId)) return false;
  if (input.searchPreferences.opportunitiesPrefConfirmedAt) return false;
  if (input.onboardingJustFinished) return true;
  const missingFunctions = input.prioritizedCategories.length === 0;
  const missingRoles = input.targetRoles.length === 0;
  const missingExperience = !(input.searchPreferences.experienceLevelLabels?.length);
  return missingFunctions || missingRoles || missingExperience;
}

export function useOpportunitiesPrefConfirmVisible(
  input: Parameters<typeof shouldShowOpportunitiesPrefConfirm>[0] | null,
): boolean {
  return useMemo(() => (input ? shouldShowOpportunitiesPrefConfirm(input) : false), [input]);
}

"use client";

import { useEffect, useState } from "react";
import { LocationAutocompleteInput } from "@/components/scout/location-autocomplete-input";
import {
  ONBOARDING_RELOCATION_OPTIONS,
  ONBOARDING_VISA_OPTIONS,
  ONBOARDING_WORK_ARRANGEMENTS,
  buildOnboardingPriorities,
  relocationOpennessFromId,
  type RelocationId,
  type VisaNeedId,
  type WorkArrangementId,
} from "@/lib/onboarding-preferences";
import { SALARY_RANGES } from "@/components/scout/screens";
import type { MatchingTuningGapId } from "@/lib/recommendation-tuning";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

export type MatchingPrefProfile = {
  targetRoles: string[];
  prioritizedRoles: string[];
  targetMarket: string;
  fullyRemote: boolean;
  workArrangement: WorkArrangementId;
  relocation: RelocationId;
  visaNeed: VisaNeedId;
  targetSalary: string;
  jobTimeline: string;
  priorities: string[];
};

type Props = {
  open: boolean;
  gapId: MatchingTuningGapId | null;
  profile: MatchingPrefProfile;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onOpenGoalWizard?: () => void;
};

const TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "3-6mo", label: "In the next 3–6 months" },
  { value: "open", label: "Whenever the right role appears" },
];

function listOption(selected: boolean, onClick: () => void, label: string) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        border: selected ? `1.5px solid ${color.forest}` : border.line,
        borderRadius: "var(--scout-radius)",
        background: selected ? "rgba(74,139,106,0.1)" : surface.inset,
        cursor: "pointer",
        fontFamily: fontSans,
        fontSize: T.bodySm,
        color: color.ink,
      }}
    >
      {label}
    </button>
  );
}

export function MatchingPrefPromptModal({
  open,
  gapId,
  profile,
  onClose,
  onSave,
  onOpenGoalWizard,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState(profile);

  useEffect(() => {
    if (open) setLocal(profile);
  }, [open, profile]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !gapId) return null;

  const titleMap: Record<MatchingTuningGapId, { title: string; body: string }> = {
    target_roles: { title: "Add target roles", body: "Open your profile to add up to 3 role titles." },
    priority_role: { title: "Pick your #1 target role", body: "We boost this title in your recommended feed." },
    location: { title: "Where do you want to work?", body: "City or fully remote — powers location filtering." },
    work_mode: { title: "How do you want to work?", body: "Remote, hybrid, or open to on-site." },
    relocation: { title: "Would you relocate?", body: "Expands or tightens geographies in your feed." },
    visa: { title: "Work authorization", body: "Helps filter for visa sponsorship when needed." },
    salary: { title: "Target salary floor", body: "Filters roles below your range when data exists." },
    timeline: { title: "Search timeline", body: "Fresh postings rank higher when you're moving fast." },
    primary_goal: { title: "Add a primary goal", body: "Improves coach matching on your dashboard." },
    resume: { title: "Upload a resume", body: "Powers skill overlap and role fit scoring." },
  };

  const copy = titleMap[gapId];

  const savePatch = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await onSave(patch);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const renderBody = () => {
    if (gapId === "target_roles" || gapId === "resume") {
      return (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: 0 }}>
          Use Profile → {gapId === "target_roles" ? "About or target roles" : "Resumes"} to complete this step.
        </p>
      );
    }

    if (gapId === "primary_goal") {
      return (
        <ScoutPrimaryBtn
          onClick={() => {
            onClose();
            onOpenGoalWizard?.();
          }}
          style={{ width: "100%", minHeight: 44 }}
        >
          Open goal wizard
        </ScoutPrimaryBtn>
      );
    }

    if (gapId === "priority_role") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {local.targetRoles.map((role) =>
            listOption(local.prioritizedRoles[0] === role, () => setLocal({ ...local, prioritizedRoles: [role] }), role),
          )}
        </div>
      );
    }

    if (gapId === "location") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            type="button"
            onClick={() => setLocal({ ...local, fullyRemote: !local.fullyRemote, targetMarket: local.fullyRemote ? local.targetMarket : "" })}
            style={{
              padding: "10px 14px",
              border: local.fullyRemote ? `1.5px solid ${color.forest}` : border.line,
              borderRadius: "var(--scout-radius)",
              background: surface.inset,
              cursor: "pointer",
              fontFamily: fontSans,
              fontSize: T.caption,
              textAlign: "left",
            }}
          >
            Fully remote — no fixed city
          </button>
          {!local.fullyRemote && (
            <LocationAutocompleteInput
              value={local.targetMarket}
              onChange={(v) => setLocal({ ...local, targetMarket: v })}
              placeholder="Start typing a city…"
            />
          )}
        </div>
      );
    }

    if (gapId === "work_mode") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ONBOARDING_WORK_ARRANGEMENTS.map(({ value, label }) =>
            listOption(
              local.workArrangement === value,
              () => setLocal({ ...local, workArrangement: local.workArrangement === value ? "" : value }),
              label,
            ),
          )}
        </div>
      );
    }

    if (gapId === "relocation") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ONBOARDING_RELOCATION_OPTIONS.map(({ value, label }) =>
            listOption(
              local.relocation === value,
              () => setLocal({ ...local, relocation: local.relocation === value ? "" : value }),
              label,
            ),
          )}
        </div>
      );
    }

    if (gapId === "visa") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ONBOARDING_VISA_OPTIONS.map(({ value, label }) =>
            listOption(
              local.visaNeed === value,
              () => setLocal({ ...local, visaNeed: local.visaNeed === value ? "" : value }),
              label,
            ),
          )}
        </div>
      );
    }

    if (gapId === "salary") {
      return (
        <select
          value={local.targetSalary}
          onChange={(e) => setLocal({ ...local, targetSalary: e.target.value })}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: border.line,
            fontFamily: fontSans,
            fontSize: T.bodySm,
            boxSizing: "border-box",
          }}
        >
          <option value="">Select a range</option>
          {SALARY_RANGES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      );
    }

    if (gapId === "timeline") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TIMELINES.map(({ value, label }) =>
            listOption(
              local.jobTimeline === value,
              () => setLocal({ ...local, jobTimeline: local.jobTimeline === value ? "" : value }),
              label,
            ),
          )}
        </div>
      );
    }

    return null;
  };

  const handleSave = async () => {
    if (gapId === "target_roles" || gapId === "resume" || gapId === "primary_goal") return;

    if (gapId === "priority_role") {
      await savePatch({ prioritizedRoles: local.prioritizedRoles.slice(0, 1) });
      return;
    }

    const priorities = buildOnboardingPriorities({
      workArrangement: local.workArrangement,
      relocation: local.relocation,
      visaNeed: local.visaNeed,
      fullyRemote: local.fullyRemote,
    });

    if (gapId === "location") {
      await savePatch({
        targetMarket: local.fullyRemote ? null : local.targetMarket.trim() || null,
        priorities,
      });
      return;
    }

    if (gapId === "work_mode") {
      await savePatch({ priorities });
      return;
    }

    if (gapId === "relocation") {
      await savePatch({
        relocationOpenness: relocationOpennessFromId(local.relocation),
        priorities,
      });
      return;
    }

    if (gapId === "visa") {
      const auth =
        local.visaNeed === "sponsored"
          ? "Need visa sponsorship"
          : local.visaNeed === "authorized"
            ? "Authorized to work without sponsorship"
            : null;
      await savePatch({ workAuthorization: auth, priorities });
      return;
    }

    if (gapId === "salary") {
      await savePatch({ targetSalary: local.targetSalary || null });
      return;
    }

    if (gapId === "timeline") {
      await savePatch({ jobTimeline: local.jobTimeline || null });
    }
  };

  const canSave = gapId !== "target_roles" && gapId !== "resume" && gapId !== "primary_goal";

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
          <h2 style={{ ...displayTitleStyle(20), margin: "0 0 8px" }}>{copy.title}</h2>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, margin: "0 0 20px", lineHeight: 1.55 }}>
            {copy.body}
          </p>
          <div style={{ marginBottom: 20 }}>{renderBody()}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <ScoutSecondaryBtn onClick={onClose} disabled={saving}>
              Cancel
            </ScoutSecondaryBtn>
            {canSave && (
              <ScoutPrimaryBtn onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </ScoutPrimaryBtn>
            )}
            {(gapId === "target_roles" || gapId === "resume") && (
              <ScoutPrimaryBtn onClick={() => { onClose(); window.location.href = gapId === "resume" ? "/profile" : "/profile"; }}>
                Open profile
              </ScoutPrimaryBtn>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import type { DashboardGoalOption } from "@/lib/dashboard-goals";
import { ScoutModal } from "@/components/scout/scout-modal";
import { ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { color, displayTitleStyle, fontSans, type as T } from "@/lib/typography";

type Props = {
  sync: NonNullable<DashboardGoalOption["profileSync"]>;
  onConfirm: () => void;
  onSkip: () => void;
  saving?: boolean;
};

export function ProfileSyncPromptModal({ sync, onConfirm, onSkip, saving }: Props) {
  return (
    <ScoutModal open bruddle onClose={onSkip} ariaLabelledBy="profile-sync-title" maxWidth={420}>
      <p id="profile-sync-title" style={{ ...displayTitleStyle(22), margin: "0 0 10px", lineHeight: 1.3 }}>
        Update your profile?
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.6, marginBottom: 24 }}>
        {sync.prompt} Better matches when your profile reflects this — change it anytime under Profile.
      </p>
      <ScoutPrimaryBtn onClick={onConfirm} disabled={saving} style={{ width: "100%", minHeight: 44, marginBottom: 10 }}>
        {saving ? "Saving…" : "Yes, update profile"}
      </ScoutPrimaryBtn>
      <button
        type="button"
        onClick={onSkip}
        disabled={saving}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: fontSans,
          fontSize: T.bodySm,
          color: color.muted,
        }}
      >
        Not now
      </button>
    </ScoutModal>
  );
}

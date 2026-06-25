"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { DashboardGoalOption } from "@/lib/dashboard-goals";
import { fontSans, color, border, type as T } from "@/lib/typography";

type Props = {
  sync: NonNullable<DashboardGoalOption["profileSync"]>;
  onConfirm: () => void;
  onSkip: () => void;
  saving?: boolean;
};

export function ProfileSyncPromptModal({ sync, onConfirm, onSkip, saving }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div onClick={onSkip} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
      <div
        role="dialog"
        aria-labelledby="profile-sync-title"
        style={{
          position: "relative",
          background: "#fff",
          padding: "28px 24px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <p
          id="profile-sync-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            fontWeight: 600,
            fontStyle: "italic",
            color: color.ink,
            marginBottom: 10,
            lineHeight: 1.3,
          }}
        >
          Update your profile?
        </p>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.6, marginBottom: 24 }}>
          {sync.prompt} This helps us tailor recommendations — you can change it anytime in Profile.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          style={{
            width: "100%",
            padding: "12px 0",
            background: color.forest,
            color: "#E8D5A3",
            border: "none",
            fontFamily: fontSans,
            fontSize: T.bodySm,
            fontWeight: 600,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
            marginBottom: 10,
          }}
        >
          {saving ? "Saving…" : "Yes, update profile"}
        </button>
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
      </div>
    </div>,
    document.body,
  );
}

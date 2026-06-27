"use client";

import { ScoutModal } from "@/components/scout/scout-modal";
import { radius } from "@/lib/typography";

type Props = { onClose: () => void };

export function GrowthWelcomeModal({ onClose }: Props) {
  return (
    <ScoutModal
      open
      onClose={onClose}
      maxWidth={420}
      padding="40px 36px"
      zIndex={70}
      panelStyle={{
        background: "#1A3A2F",
        border: "1px solid rgba(232,213,163,0.25)",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          fontWeight: 600,
          fontStyle: "italic",
          color: "#E8D5A3",
          marginBottom: 12,
          lineHeight: 1.2,
        }}
      >
        You&apos;re on Pro.
      </p>
      <p
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 15,
          color: "rgba(232,213,163,0.75)",
          lineHeight: 1.65,
          marginBottom: 28,
        }}
      >
        Unlimited match analysis, tailoring, cover letters, and Scout — no credit counter. Pick a job and run a full tailor pass.
      </p>
      <button
        onClick={onClose}
        style={{
          padding: "12px 28px",
          background: "#E8D5A3",
          color: "#1A3A2F",
          border: "none",
          borderRadius: radius.box,
          fontFamily: "var(--font-ui)",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Let&apos;s go →
      </button>
    </ScoutModal>
  );
}

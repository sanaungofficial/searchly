"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PricingPanel } from "./pricing-panel";
import { bruddleHeadingStyle, color, fontSans, radius, type as T } from "@/lib/typography";

type Props = {
  onClose: () => void;
};

export function PricingModal({ onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(22, 22, 22, 0.45)",
          zIndex: 200,
        }}
        onClick={onClose}
        aria-hidden
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 201,
          padding: 16,
          pointerEvents: "none",
        }}
      >
        <div
          role="dialog"
          aria-labelledby="pricing-modal-title"
          aria-modal="true"
          className="bruddle"
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: "auto",
            width: 920,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "min(90vh, calc(100dvh - 32px))",
            overflow: "auto",
            background: "#FAF4F0",
            border: "var(--scout-border)",
            borderRadius: radius.px,
            boxShadow: "4px 4px 0 #161616",
            padding: "24px 28px 28px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span
              id="pricing-modal-title"
              style={{
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 600,
                color: color.muted,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Plans & pricing
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "transparent",
                border: "var(--scout-border)",
                borderRadius: radius.px,
                width: 32,
                height: 32,
                fontSize: 18,
                lineHeight: 1,
                cursor: "pointer",
                color: "#161616",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
          </div>
          <PricingPanel compact />
        </div>
      </div>
    </>,
    document.body,
  );
}

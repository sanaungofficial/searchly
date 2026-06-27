"use client";

import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEffect } from "react";
import { border, radius, shadow, surface } from "@/lib/typography";

const scoutModalPanelStyle = (extra?: CSSProperties): CSSProperties => ({
  position: "relative",
  background: surface.card,
  border: border.lineStrong,
  borderRadius: radius.box,
  boxShadow: shadow.cardStrong,
  width: "100%",
  boxSizing: "border-box",
  ...extra,
});

/** Centered modal shell — ScoutBox elevation + 10px radius */
export function ScoutModal({
  open,
  onClose,
  children,
  maxWidth = 480,
  zIndex = 1100,
  ariaLabelledBy,
  padding = "28px 24px",
  panelStyle,
  closeOnEscape = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  zIndex?: number;
  ariaLabelledBy?: string;
  padding?: number | string;
  panelStyle?: CSSProperties;
  closeOnEscape?: boolean;
}) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={onClose}
        aria-hidden
        style={{ position: "absolute", inset: 0, background: "rgba(15, 24, 20, 0.35)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        onClick={(e) => e.stopPropagation()}
        style={scoutModalPanelStyle({ maxWidth, padding, ...panelStyle })}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

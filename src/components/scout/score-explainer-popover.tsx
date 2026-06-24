"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SCORE_EXPLAINERS, type ScoreExplainerVariant } from "@/lib/score-methodology";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";
import { EyeIcon } from "./workspace-icons";

type Props = {
  variant: ScoreExplainerVariant;
  iconOnly?: boolean;
  label?: string;
  align?: "left" | "right";
};

export function ScoreExplainerPopover({
  variant,
  iconOnly = true,
  label = "How this score works",
  align = "left",
}: Props) {
  const content = SCORE_EXPLAINERS[variant];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearCloseTimer]);

  const show = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return (
    <div
      ref={rootRef}
      style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={content.title}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: iconOnly ? 0 : 5,
          padding: iconOnly ? 4 : "5px 8px",
          background: open ? "rgba(26,58,47,0.06)" : "transparent",
          border: iconOnly ? "none" : border.line,
          borderRadius: 0,
          cursor: "pointer",
          color: color.muted,
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 600,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        <EyeIcon style={{ width: iconOnly ? 13 : 14, height: iconOnly ? 13 : 14, opacity: 0.7 }} />
        {!iconOnly && <span>{label}</span>}
      </button>

      {open && (
        <div
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={scheduleClose}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            width: 320,
            maxWidth: "min(320px, calc(100vw - 24px))",
            zIndex: 130,
            background: surface.card,
            border: border.lineStrong,
            boxShadow: "4px 4px 0 rgba(17,17,17,0.08)",
            padding: "14px 16px 12px",
          }}
        >
          <p
            style={{
              margin: "0 0 2px",
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 700,
              color: color.muted,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            {content.title}
          </p>
          <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: T.caption, color: color.stone, lineHeight: 1.45 }}>
            {content.subtitle}
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {content.bullets.map((item) => (
              <li key={item.title} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                <span style={{ color: color.forest, fontWeight: 700, fontSize: 11, lineHeight: 1.5, flexShrink: 0 }}>✓</span>
                <div>
                  <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.ink }}>
                    {item.title}
                  </p>
                  <p style={{ margin: "1px 0 0", fontFamily: fontSans, fontSize: 11, color: color.muted, lineHeight: 1.5 }}>
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {content.scaleNote && (
            <p
              style={{
                margin: "10px 0 0",
                paddingTop: 8,
                borderTop: border.line,
                fontFamily: fontSans,
                fontSize: 10,
                color: color.mutedLight,
                lineHeight: 1.45,
              }}
            >
              {content.scaleNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ScoreExplainerLabel({
  variant,
  children,
  align = "left",
}: {
  variant: ScoreExplainerVariant;
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {children}
      <ScoreExplainerPopover variant={variant} align={align} />
    </span>
  );
}

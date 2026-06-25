"use client";

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHoverCapable } from "@/hooks/use-hover-capable";
import { SCORE_EXPLAINERS, type ScoreExplainerVariant } from "@/lib/score-methodology";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";
import { EyeIcon } from "./workspace-icons";

type Props = {
  variant: ScoreExplainerVariant;
  iconOnly?: boolean;
  label?: string;
  align?: "left" | "right";
  /** Use on dark backgrounds (e.g. forest green progress card). */
  light?: boolean;
};

function ExplainerPanel({ variant }: { variant: ScoreExplainerVariant }) {
  const content = SCORE_EXPLAINERS[variant];

  return (
    <>
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
    </>
  );
}

export function ScoreExplainerPopover({
  variant,
  iconOnly = true,
  label = "How this score works",
  align = "left",
  light = false,
}: Props) {
  const content = SCORE_EXPLAINERS[variant];
  const [open, setOpen] = useState(false);
  const hoverCapable = useHoverCapable();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (!hoverCapable) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearCloseTimer, hoverCapable]);

  const show = useCallback(() => {
    if (!hoverCapable) return;
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer, hoverCapable]);

  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", verticalAlign: "middle" }}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={content.title}
            aria-expanded={open}
            onMouseEnter={show}
            onMouseLeave={scheduleClose}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: iconOnly ? 0 : 5,
              padding: iconOnly ? 4 : "5px 8px",
              background: open ? "rgba(26,58,47,0.06)" : "transparent",
              border: iconOnly ? "none" : border.line,
              borderRadius: 0,
              cursor: "pointer",
              color: light ? "rgba(232,213,163,0.75)" : color.muted,
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 600,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            <EyeIcon style={{ width: iconOnly ? 13 : 14, height: iconOnly ? 13 : 14, opacity: light ? 0.9 : 0.7 }} />
            {!iconOnly && <span>{label}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={align === "right" ? "end" : "start"}
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={show}
          onMouseLeave={scheduleClose}
          className="rounded-none border-0 bg-transparent p-0 shadow-none outline-none"
          style={{
            width: 320,
            maxWidth: "min(320px, calc(100vw - 24px))",
            zIndex: 10000,
            background: surface.card,
            border: border.lineStrong,
            boxShadow: "4px 4px 0 rgba(17,17,17,0.08)",
            padding: "14px 16px 12px",
          }}
        >
          <ExplainerPanel variant={variant} />
        </PopoverContent>
      </Popover>
    </span>
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

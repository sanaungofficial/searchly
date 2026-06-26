"use client";

import type { ReactNode } from "react";
import { ScoutDisplayTitle, ScoutLabel } from "./scout-box";
import { WORKSPACE_MAX_WIDTH, WorkspaceContent, WorkspaceScroll } from "./workspace-content";
import { color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  label?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  isMobile?: boolean;
  /** Short title for mobile top bar (defaults to label) — kept for API compat, unused with top nav */
  mobileBarTitle?: string;
  /** Omit label + title chrome — content only (Dashboard staff sub-tabs). */
  compact?: boolean;
  children: ReactNode;
  /** Max content width; defaults to WORKSPACE_MAX_WIDTH */
  maxWidth?: number;
};

/** Citebound workspace page chrome — cream bg, editorial header, scroll body */
export function WorkspacePageShell({
  label,
  title,
  subtitle,
  isMobile = false,
  children,
  maxWidth = WORKSPACE_MAX_WIDTH,
  compact = false,
}: Props) {
  if (compact) {
    return (
      <div style={{ width: "100%", boxSizing: "border-box" }}>
        {children}
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <WorkspaceScroll>
        <WorkspaceContent style={{ maxWidth }}>
          <div style={{ marginBottom: isMobile ? 20 : 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
              <ScoutLabel>{label}</ScoutLabel>
            </div>
            <ScoutDisplayTitle size={isMobile ? 28 : 36} style={{ marginBottom: subtitle ? 10 : 0 }}>
              {title}
            </ScoutDisplayTitle>
            {subtitle ? (
              <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 520, lineHeight: 1.6, margin: 0 }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {children}
        </WorkspaceContent>
      </WorkspaceScroll>
    </div>
  );
}

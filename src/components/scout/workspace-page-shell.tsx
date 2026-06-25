"use client";

import type { ReactNode } from "react";
import { ScoutDisplayTitle, ScoutLabel } from "./scout-box";
import { WorkspaceMobileTopBar } from "./workspace-mobile-top-bar";
import { color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  isMobile?: boolean;
  /** Short title for mobile top bar (defaults to label) */
  mobileBarTitle?: string;
  children: ReactNode;
  maxWidth?: number;
};

/** Citebound workspace page chrome — cream bg, editorial header, scroll body */
export function WorkspacePageShell({
  label,
  title,
  subtitle,
  isMobile = false,
  mobileBarTitle,
  children,
  maxWidth = 1120,
}: Props) {
  const pad = isMobile ? "20px 16px 48px" : "32px 36px 48px";
  const barTitle = mobileBarTitle ?? label;

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
      {isMobile && (
        <WorkspaceMobileTopBar center={<ScoutLabel>{barTitle}</ScoutLabel>} />
      )}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          background: surface.page,
        }}
      >
        <div style={{ padding: pad, maxWidth, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ marginBottom: isMobile ? 20 : 24 }}>
            {!isMobile && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
                <ScoutLabel>{label}</ScoutLabel>
              </div>
            )}
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
        </div>
      </div>
    </div>
  );
}

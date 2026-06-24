"use client";

import type { ReactNode } from "react";
import { ScoutDisplayTitle, ScoutLabel } from "./scout-box";
import { color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  label: string;
  title: ReactNode;
  subtitle?: ReactNode;
  isMobile?: boolean;
  children: ReactNode;
  maxWidth?: number;
};

/** Citebound workspace page chrome — cream bg, editorial header, scroll body */
export function WorkspacePageShell({
  label,
  title,
  subtitle,
  isMobile = false,
  children,
  maxWidth = 1120,
}: Props) {
  const pad = isMobile ? "16px 16px 0" : "20px 32px 0";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: pad, maxWidth, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
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
        </div>
      </div>
    </div>
  );
}

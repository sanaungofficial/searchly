"use client";

import type { ReactNode } from "react";
import { border, surface } from "@/lib/typography";

/** Left gutter so floating hamburger (layout) does not cover centered content */
export const MOBILE_MENU_GUTTER = 52;

export const MOBILE_TOP_BAR_HEIGHT = 48;

type Props = {
  center: ReactNode;
  right?: ReactNode;
  noBorder?: boolean;
};

/** Single mobile chrome row — menu button sits in the left gutter from layout.tsx */
export function WorkspaceMobileTopBar({ center, right, noBorder }: Props) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        minHeight: MOBILE_TOP_BAR_HEIGHT,
        padding: "6px 12px",
        paddingLeft: MOBILE_MENU_GUTTER,
        borderBottom: noBorder ? undefined : border.line,
        background: surface.card,
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: MOBILE_MENU_GUTTER,
          right: 12,
          top: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto", maxWidth: "100%" }}>{center}</div>
      </div>
      {right ? (
        <div style={{ marginLeft: "auto", position: "relative", zIndex: 1, flexShrink: 0 }}>
          {right}
        </div>
      ) : null}
    </div>
  );
}

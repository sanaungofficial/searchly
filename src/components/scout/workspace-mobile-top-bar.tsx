"use client";

import type { ReactNode } from "react";
import { border, surface } from "@/lib/typography";

export const MOBILE_TOP_BAR_HEIGHT = 48;

type Props = {
  center: ReactNode;
  right?: ReactNode;
  noBorder?: boolean;
};

/** Optional page-level chrome row below the global top nav */
export function WorkspaceMobileTopBar({ center, right, noBorder }: Props) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        minHeight: MOBILE_TOP_BAR_HEIGHT,
        padding: "6px 16px",
        borderBottom: noBorder ? undefined : border.line,
        background: surface.card,
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {center}
      </div>
      {right ? (
        <div style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", flexShrink: 0 }}>
          {right}
        </div>
      ) : null}
    </div>
  );
}

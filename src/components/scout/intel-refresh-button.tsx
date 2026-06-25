"use client";

import { RefreshIcon } from "./workspace-icons";
import { fontSans, color, border, type as T } from "@/lib/typography";

export function IntelRefreshButton({
  onClick,
  disabled,
  label = "Refresh",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        minHeight: 32,
        background: "transparent",
        border: border.line,
        color: color.muted,
        fontFamily: fontSans,
        fontSize: T.caption,
        fontWeight: 600,
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <RefreshIcon style={{ flexShrink: 0 }} />
      {disabled ? "Refreshing…" : label}
    </button>
  );
}

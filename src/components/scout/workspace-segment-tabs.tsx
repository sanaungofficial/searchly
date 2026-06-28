"use client";

import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type Tab<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  isMobile?: boolean;
  variant?: "default" | "bruddle";
};

/** Square Citebound tab strip */
export function WorkspaceSegmentTabs<T extends string>({ tabs, active, onChange, isMobile, variant = "default" }: Props<T>) {
  const isBruddle = variant === "bruddle";
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 0,
        border: isBruddle ? "1.5px solid #161616" : border.line,
        marginBottom: isMobile ? 16 : 20,
        flexWrap: "wrap",
      }}
    >
      {tabs.map(({ id, label }, i) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={{
              padding: isMobile ? "10px 16px" : "8px 18px",
              minHeight: isMobile ? 44 : undefined,
              border: "none",
              borderRight: i < tabs.length - 1 ? (isBruddle ? "1.5px solid #161616" : border.line) : undefined,
              background: isBruddle ? (isActive ? "#161616" : "transparent") : (isActive ? color.forest : surface.card),
              color: isBruddle ? (isActive ? "#FFFFFF" : "#161616") : (isActive ? color.gold : color.stone),
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

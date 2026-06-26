"use client";

import { border, color, fontSans, surface, type as T } from "@/lib/typography";

export type ProfileTabItem = {
  id: string;
  label: string;
  href: string;
};

type Props = {
  tabs: ProfileTabItem[];
  activeHref: string;
  onNavigate: (href: string) => void;
  isMobile?: boolean;
  /** segmented = bordered row (Profile). pills = spaced chips. underline = Opportunities-style text tabs. */
  variant?: "segmented" | "pills" | "underline";
};

/** Tab strip — segmented on Profile, underline on Dashboard staff, pills optional. */
export function WorkspaceProfileTabBar({
  tabs,
  activeHref,
  onNavigate,
  isMobile,
  variant = "segmented",
}: Props) {
  const marginBottom = isMobile ? 16 : 20;

  if (variant === "underline") {
    return (
      <div
        style={{
          display: "flex",
          gap: 0,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          flexShrink: 0,
        }}
      >
        {tabs.map(({ id, label, href }) => {
          const active =
            href === "/dashboard" ? activeHref === "/dashboard" : activeHref.startsWith(href);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(href)}
              style={{
                padding: isMobile ? "8px 14px" : "7px 18px",
                border: "none",
                borderBottom: active ? `2px solid ${color.forest}` : "2px solid transparent",
                background: "transparent",
                color: active ? color.forest : color.muted,
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
                letterSpacing: "0.1px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === "pills") {
    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom,
        }}
      >
        {tabs.map(({ id, label, href }) => {
          const active =
            href === "/dashboard" ? activeHref === "/dashboard" : activeHref.startsWith(href);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(href)}
              style={{
                padding: isMobile ? "10px 16px" : "10px 20px",
                minHeight: 40,
                border: active ? `1px solid ${color.forest}` : border.line,
                background: active ? color.forest : surface.card,
                color: active ? color.gold : color.muted,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "inline-flex",
        maxWidth: "100%",
        border: border.line,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        flexShrink: 0,
        marginBottom,
      }}
    >
      {tabs.map(({ id, label, href }, i) => {
        const active =
          href === "/dashboard" ? activeHref === "/dashboard" : activeHref.startsWith(href);
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(href)}
            style={{
              padding: isMobile ? "10px 14px" : "8px 16px",
              minHeight: 44,
              border: "none",
              borderRight: i < tabs.length - 1 ? border.line : "none",
              background: active ? color.forest : surface.card,
              color: active ? color.gold : color.muted,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

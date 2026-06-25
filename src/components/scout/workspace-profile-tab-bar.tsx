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
  /** segmented = bordered row (Profile). pills = spaced chips (Dashboard staff). */
  variant?: "segmented" | "pills";
};

/** Tab strip — segmented on Profile, pill chips on Dashboard staff portal. */
export function WorkspaceProfileTabBar({
  tabs,
  activeHref,
  onNavigate,
  isMobile,
  variant = "segmented",
}: Props) {
  const marginBottom = isMobile ? 16 : 20;

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

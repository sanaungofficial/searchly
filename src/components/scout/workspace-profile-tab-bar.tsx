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
};

/** Full-width tab strip — matches Profile page tab bar. */
export function WorkspaceProfileTabBar({ tabs, activeHref, onNavigate, isMobile }: Props) {
  return (
    <div
      style={{
        display: "flex",
        border: border.line,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        flexShrink: 0,
        marginBottom: isMobile ? 16 : 20,
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

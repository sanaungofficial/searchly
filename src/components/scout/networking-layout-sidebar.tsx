"use client";

import type { NetworkingSection } from "@/lib/workspace-urls";
import { color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

export const NETWORKING_SIDEBAR_TABS: { id: NetworkingSection; label: string }[] = [
  { id: "leads", label: "Leads" },
  { id: "inbox", label: "Inbox" },
  { id: "in-network", label: "In-Network Roles" },
];

type Props = {
  tabs: { id: NetworkingSection; label: string }[];
  activeSection: NetworkingSection;
  onNavigate: (section: NetworkingSection) => void;
};

export function NetworkingLayoutSidebar({ tabs, activeSection, onNavigate }: Props) {
  return (
    <aside
      style={{
        width: 272,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "sticky",
        top: 16,
        alignSelf: "flex-start",
      }}
    >
      <div
        style={{
          background: surface.card,
          border: "var(--scout-border)",
          borderRadius: "var(--scout-radius)",
          overflow: "hidden",
          boxShadow: "var(--scout-shadow-card)",
        }}
      >
        <div style={{ height: 56, background: "rgba(74,139,106,0.18)" }} />
        <div style={{ padding: "0 20px 18px", marginTop: -24, textAlign: "left" }}>
          <h2 style={{ ...displayTitleStyle(22), marginBottom: 8 }}>Networking</h2>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            Leads, inbox, and recruiter-network roles in one place.
          </p>
        </div>
      </div>

      <nav
        style={{
          background: surface.card,
          border: "var(--scout-border)",
          borderRadius: "var(--scout-radius)",
          padding: 6,
          boxShadow: "var(--scout-shadow-card)",
        }}
      >
        {tabs.map(({ id, label }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 14px",
                minHeight: 44,
                border: "none",
                borderRadius: "calc(var(--scout-radius) - 2px)",
                background: active ? surface.inset : "transparent",
                color: active ? color.ink : color.muted,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s ease",
              }}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

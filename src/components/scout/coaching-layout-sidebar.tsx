"use client";

import { AssignedCoachSummaryBox } from "@/components/scout/assigned-coach-summary-box";
import { fontSans, color, surface, type as T } from "@/lib/typography";

export type CoachingTab =
  | "directory"
  | "my-coaches"
  | "bookings"
  | "notes"
  | "resources";

type TabItem = { id: CoachingTab; label: string };

type CoachingSidebarProps = {
  tabs: TabItem[];
  activePage: CoachingTab;
  onNavigate: (tab: CoachingTab) => void;
  coachCount?: number;
  sessionCount?: number;
};

export function CoachingLayoutSidebar({
  tabs,
  activePage,
  onNavigate,
}: CoachingSidebarProps) {
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
      <AssignedCoachSummaryBox />

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
          const active = activePage === id;
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

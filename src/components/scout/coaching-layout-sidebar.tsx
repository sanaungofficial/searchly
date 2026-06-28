"use client";

import { fontSans, fontDisplay, color, surface, border, type as T } from "@/lib/typography";

export type CoachingTab =
  | "directory"
  | "my-coaches"
  | "sessions"
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

function CoachingIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="18" cy="9" r="4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2 21c0-3.314 3.134-6 7-6M24 21c0-3.314-3.134-6-7-6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M13 15c2.21 0 4 1.567 4 3.5V21H9v-2.5C9 16.567 10.79 15 13 15Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function CoachingLayoutSidebar({
  tabs,
  activePage,
  onNavigate,
  coachCount,
  sessionCount,
}: CoachingSidebarProps) {
  const hasStats = coachCount !== undefined || sessionCount !== undefined;

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
          border: border.line,
          borderRadius: "var(--scout-radius)",
          overflow: "hidden",
          boxShadow: "var(--scout-shadow-card)",
        }}
      >
        <div style={{ height: 56, background: "rgba(74,139,106,0.18)" }} />
        <div style={{ padding: "0 20px 18px", marginTop: -28, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              margin: "0 auto 12px",
              border: "3px solid white",
              background: "rgba(74,139,106,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: color.forest,
            }}
          >
            <CoachingIcon />
          </div>
          <h2 style={{ fontFamily: fontDisplay, fontSize: 18, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>
            1:1 Coaching
          </h2>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.45 }}>
            Expert guidance, your pace
          </p>
          {hasStats && (
            <div
              style={{
                display: "flex",
                gap: 20,
                justifyContent: "center",
                marginTop: 14,
                paddingTop: 14,
                borderTop: border.line,
              }}
            >
              {coachCount !== undefined && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: fontSans, fontSize: 17, fontWeight: 700, color: color.ink, lineHeight: 1 }}>
                    {coachCount}
                  </div>
                  <div style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, marginTop: 3 }}>
                    {coachCount === 1 ? "coach" : "coaches"}
                  </div>
                </div>
              )}
              {sessionCount !== undefined && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: fontSans, fontSize: 17, fontWeight: 700, color: color.ink, lineHeight: 1 }}>
                    {sessionCount}
                  </div>
                  <div style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, marginTop: 3 }}>
                    upcoming
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <nav
        style={{
          background: surface.card,
          border: border.line,
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

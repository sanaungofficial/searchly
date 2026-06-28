"use client";

import { fontSans, fontDisplay, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

export type ProfileSidebarTab =
  | "about"
  | "linkedin"
  | "dreamrole"
  | "targetcompanies"
  | "strategy"
  | "learning"
  | "assets"
  | "preferences";

import type { ProfileTabGap } from "@/lib/profile-readiness";

type TabItem = { id: ProfileSidebarTab; label: string };

type ProfileSidebarProps = {
  tabs: TabItem[];
  activePage: ProfileSidebarTab;
  onNavigate: (tab: ProfileSidebarTab) => void;
  name: string;
  headline?: string | null;
  location?: string | null;
  educationLabel?: string | null;
  avatarUrl?: string | null;
  completenessPct: number;
  onCompletenessClick?: () => void;
  weakestTab?: ProfileTabGap | null;
  onWeakestTabClick?: () => void;
  loading?: boolean;
};

function LocationIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M6.5 1C4.29 1 2.5 2.84 2.5 5.08c0 2.88 4 6.42 4 6.42s4-3.54 4-6.42C10.5 2.84 8.71 1 6.5 1Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="6.5" cy="5" r="1.4" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function GradCapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 5.5L7 2.5L12.5 5.5L7 8.5L1.5 5.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M3.5 6.5V9.5C3.5 9.5 4.8 11 7 11C9.2 11 10.5 9.5 10.5 9.5V6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M12.5 5.5V9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function ProfileLayoutSidebar({
  tabs,
  activePage,
  onNavigate,
  name,
  headline,
  location,
  educationLabel,
  avatarUrl,
  completenessPct,
  onCompletenessClick,
  weakestTab,
  onWeakestTabClick,
  loading,
}: ProfileSidebarProps) {
  const pctColor = completenessPct >= 80 ? color.forest : "#C4A86A";

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
      {/* Profile card */}
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
        <div style={{ padding: "0 20px 18px", marginTop: -32, textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              margin: "0 auto 12px",
              border: "3px solid white",
              background: avatarUrl ? "transparent" : "rgba(74,139,106,0.15)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontFamily: fontDisplay, fontSize: 22, color: color.forest, fontWeight: 500 }}>
                {(name || "?")[0]?.toUpperCase()}
              </span>
            )}
          </div>

          <h2 style={{ ...displayTitleStyle(22), marginBottom: 6 }}>
            {loading ? "…" : name || "Your profile"}
          </h2>

          {headline && (
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.muted,
                margin: "0 0 12px",
                lineHeight: 1.45,
              }}
            >
              {headline}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
            {location && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.muted,
                }}
              >
                <LocationIcon />
                {location}
              </span>
            )}
            {educationLabel && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.muted,
                }}
              >
                <GradCapIcon />
                {educationLabel}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onCompletenessClick}
            style={{
              display: "block",
              width: "100%",
              marginTop: 16,
              padding: 0,
              border: "none",
              background: "none",
              cursor: onCompletenessClick ? "pointer" : "default",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, fontWeight: 500 }}>
                Profile completeness
              </span>
              <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: pctColor }}>
                {completenessPct}%
              </span>
            </div>
            <div style={{ height: 4, background: "rgba(17,17,17,0.08)", borderRadius: 2 }}>
              <div
                style={{
                  height: "100%",
                  width: `${completenessPct}%`,
                  background: pctColor,
                  borderRadius: 2,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </button>
          {weakestTab && onWeakestTabClick && completenessPct < 100 && (
            <button
              type="button"
              onClick={onWeakestTabClick}
              style={{
                display: "block",
                width: "100%",
                marginTop: 10,
                padding: "8px 10px",
                border: "var(--scout-border)",
                borderRadius: "calc(var(--scout-radius) - 2px)",
                background: surface.inset,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, display: "block" }}>
                Improve {weakestTab.label} →
              </span>
              <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, lineHeight: 1.4 }}>
                {weakestTab.topAction} (+{weakestTab.missingPoints}%)
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Vertical nav */}
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

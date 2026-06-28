"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { EXPERT_WORKSPACE_NAV, expertWorkspaceNavId, type ExpertWorkspaceNavId } from "@/lib/staff-portal";
import { WorkspaceContent, WorkspaceScroll } from "@/components/scout/workspace-content";
import { border, color, fontSans, fontDisplay, surface, type as T } from "@/lib/typography";

function ExpertPortalIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect x="3" y="3" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="14" y="3" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3" y="14" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M17.5 14v9M14 17.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ExpertLayoutSidebar({ activeId }: { activeId: ExpertWorkspaceNavId | null }) {
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
            <ExpertPortalIcon />
          </div>
          <h2
            style={{
              fontFamily: fontDisplay,
              fontSize: 18,
              fontWeight: 600,
              color: color.ink,
              margin: "0 0 4px",
            }}
          >
            Expert Portal
          </h2>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            Clients, sessions &amp; offerings
          </p>
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
        {EXPERT_WORKSPACE_NAV.map(({ id, label, path }) => {
          const active = activeId === id;
          return (
            <Link
              key={id}
              href={path}
              style={{
                display: "block",
                padding: "10px 14px",
                minHeight: 44,
                borderRadius: "calc(var(--scout-radius) - 2px)",
                background: active ? surface.inset : "transparent",
                color: active ? color.ink : color.muted,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                fontWeight: active ? 600 : 500,
                textDecoration: "none",
                transition: "background 0.15s ease",
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileTabBar({ activeId }: { activeId: ExpertWorkspaceNavId | null }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        overflowX: "auto",
        padding: "0 0 12px",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch" as "touch",
        marginBottom: 16,
      }}
    >
      {EXPERT_WORKSPACE_NAV.map(({ id, label, path }) => {
        const isActive = activeId === id;
        return (
          <Link
            key={id}
            href={path}
            style={{
              flexShrink: 0,
              padding: "8px 14px",
              border: border.line,
              borderRadius: "calc(var(--scout-radius) - 2px)",
              background: isActive ? surface.inset : surface.card,
              color: isActive ? color.ink : color.muted,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: isActive ? 600 : 500,
              textDecoration: "none",
              whiteSpace: "nowrap" as const,
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

type Props = { children: React.ReactNode };

export function ExpertWorkspaceShell({ children }: Props) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const activeId = expertWorkspaceNavId(pathname);

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
      }}
    >
      <WorkspaceScroll>
        <WorkspaceContent>
          <div
            style={{
              display: isMobile ? "block" : "flex",
              gap: 32,
              alignItems: "flex-start",
            }}
          >
            {!isMobile && <ExpertLayoutSidebar activeId={activeId} />}

            <div style={{ flex: 1, minWidth: 0 }}>
              {isMobile && <MobileTabBar activeId={activeId} />}
              {children}
            </div>
          </div>
        </WorkspaceContent>
      </WorkspaceScroll>
    </div>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  EXPERT_WORKSPACE_NAV,
  expertWorkspaceNavId,
  type ExpertWorkspaceNavId,
} from "@/lib/staff-portal";
import { WORKSPACE_MAX_WIDTH, workspaceContentPadding } from "@/components/scout/workspace-content";
import { TOP_NAV_HEIGHT_MOBILE } from "@/components/scout/workspace-top-nav";
import { border, color, fontSans, radius, shadow, surface, type as T } from "@/lib/typography";

function NavIcon({ id }: { id: ExpertWorkspaceNavId }) {
  const stroke = "currentColor";
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.8, "aria-hidden": true as const };

  if (id === "inbox") {
    return (
      <svg {...common}>
        <path d="M4 6h16v12H4z" strokeLinejoin="round" />
        <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "clients") {
    return (
      <svg {...common}>
        <path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" strokeLinecap="round" />
        <circle cx="10" cy="8" r="3" />
        <path d="M20 19v-1a3 3 0 0 0-2-2.8" strokeLinecap="round" />
        <path d="M16 4.2a3 3 0 0 1 0 5.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "offerings") {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />
        <path d="M9 21V12h6v9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "live") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" fill={stroke} stroke="none" />
        <path d="M12 4v2M12 18v2" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

function BurgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function ExpertNavLinks({
  activeId,
  variant,
  onNavigate,
}: {
  activeId: ExpertWorkspaceNavId | null;
  variant: "sidebar" | "drawer";
  onNavigate?: () => void;
}) {
  if (variant === "sidebar") {
    return (
      <aside
        className="expert-workspace-desktop-sidebar"
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: border.line,
          background: surface.card,
          flexDirection: "column",
          padding: "20px 0",
        }}
      >
        <p
          style={{
            margin: "0 0 16px",
            padding: "0 20px",
            fontFamily: fontSans,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: color.muted,
          }}
        >
          Expert
        </p>
        <nav aria-label="Expert workspace" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {EXPERT_WORKSPACE_NAV.map(({ id, label, path }) => {
            const active = activeId === id;
            return (
              <Link
                key={id}
                href={path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: "0 10px",
                  padding: "10px 12px",
                  borderRadius: radius.box,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  fontWeight: active ? 600 : 500,
                  color: active ? color.forest : color.stone,
                  textDecoration: "none",
                  background: active ? "rgba(26,58,47,0.08)" : "transparent",
                  borderLeft: active ? `3px solid ${color.forest}` : "3px solid transparent",
                }}
              >
                <NavIcon id={id} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <nav aria-label="Expert workspace" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {EXPERT_WORKSPACE_NAV.map(({ id, label, path }) => {
        const active = activeId === id;
        return (
          <Link
            key={id}
            href={path}
            onClick={onNavigate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "0 12px",
              padding: "10px 12px",
              borderRadius: radius.box,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: active ? 600 : 500,
              color: active ? color.forest : color.stone,
              textDecoration: "none",
              background: active ? "rgba(26,58,47,0.08)" : "transparent",
              borderLeft: active ? `3px solid ${color.forest}` : "3px solid transparent",
            }}
          >
            <NavIcon id={id} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ExpertMobileNavDrawer({
  open,
  activeId,
  onClose,
}: {
  open: boolean;
  activeId: ExpertWorkspaceNavId | null;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close expert navigation menu"
        onClick={onClose}
        style={{
          position: "fixed",
          top: TOP_NAV_HEIGHT_MOBILE,
          left: 0,
          right: 0,
          bottom: 0,
          border: "none",
          padding: 0,
          background: "rgba(15, 24, 20, 0.35)",
          zIndex: 120,
          cursor: "pointer",
        }}
      />
      <aside
        id="expert-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Expert navigation"
        style={{
          position: "fixed",
          top: TOP_NAV_HEIGHT_MOBILE,
          left: 0,
          bottom: 0,
          width: "min(280px, calc(100vw - 48px))",
          background: surface.card,
          borderRight: border.line,
          boxShadow: "4px 0 24px rgba(0,0,0,0.12)",
          zIndex: 121,
          display: "flex",
          flexDirection: "column",
          padding: "16px 0 24px",
          animation: "expertNavSlideIn 0.2s ease both",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px 12px",
            marginBottom: 8,
            borderBottom: border.line,
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: fontSans,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: color.muted,
            }}
          >
            Expert workspace
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              lineHeight: 1,
              color: color.muted,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>
        <ExpertNavLinks activeId={activeId} variant="drawer" onNavigate={onClose} />
      </aside>
      <style>{`
        @keyframes expertNavSlideIn {
          from { transform: translateX(-100%); opacity: 0.6; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

type Props = {
  children: React.ReactNode;
};

export function ExpertWorkspaceShell({ children }: Props) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const activeId = expertWorkspaceNavId(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  const activeLabel = EXPERT_WORKSPACE_NAV.find((item) => item.id === activeId)?.label ?? "Expert";

  useEffect(() => {
    if (!isMobile && menuOpen) setMenuOpen(false);
  }, [isMobile, menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen, isMobile]);

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
        position: "relative",
      }}
    >
      <ExpertMobileNavDrawer open={menuOpen} activeId={activeId} onClose={() => setMenuOpen(false)} />

      <div
        style={{
          width: "100%",
          maxWidth: WORKSPACE_MAX_WIDTH,
          margin: "0 auto",
          padding: workspaceContentPadding(isMobile),
          boxSizing: "border-box",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: surface.card,
            border: border.line,
            borderRadius: radius.box,
            boxShadow: shadow.card,
          }}
        >
          <header
            className="expert-workspace-mobile-bar"
            style={{
              alignItems: "center",
              gap: 12,
              padding: "10px 16px",
              borderBottom: border.line,
              background: surface.card,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open expert navigation menu"
              aria-expanded={menuOpen}
              aria-controls="expert-mobile-nav"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                padding: 0,
                border: border.line,
                borderRadius: radius.box,
                background: surface.card,
                color: color.forest,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <BurgerIcon />
            </button>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: fontSans,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: color.muted,
                }}
              >
                Expert
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  fontWeight: 600,
                  color: color.forest,
                }}
              >
                {activeLabel}
              </p>
            </div>
          </header>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              overflow: "hidden",
            }}
          >
            <ExpertNavLinks activeId={activeId} variant="sidebar" />
            <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {children}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .expert-workspace-mobile-bar {
          display: none;
        }
        .expert-workspace-desktop-sidebar {
          display: flex;
        }
        @media (max-width: 767px) {
          .expert-workspace-mobile-bar {
            display: flex;
          }
          .expert-workspace-desktop-sidebar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

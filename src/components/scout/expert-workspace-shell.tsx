"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  EXPERT_WORKSPACE_NAV,
  expertWorkspaceNavId,
  type ExpertWorkspaceNavId,
} from "@/lib/staff-portal";
import { WORKSPACE_MAX_WIDTH, workspaceContentPadding } from "@/components/scout/workspace-content";
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
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}

function ExpertNavLinks({
  activeId,
  variant,
}: {
  activeId: ExpertWorkspaceNavId | null;
  variant: "sidebar" | "tabs";
}) {
  if (variant === "tabs") {
    return (
      <nav
        aria-label="Expert workspace"
        style={{
          display: "flex",
          gap: 0,
          overflowX: "auto",
          borderBottom: border.line,
          background: surface.card,
          flexShrink: 0,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {EXPERT_WORKSPACE_NAV.map(({ id, label, path }) => {
          const active = activeId === id;
          return (
            <Link
              key={id}
              href={path}
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "12px 14px",
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: active ? 600 : 500,
                color: active ? color.forest : color.muted,
                textDecoration: "none",
                borderBottom: active ? `2px solid ${color.forest}` : "2px solid transparent",
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

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: border.line,
        background: surface.card,
        display: "flex",
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

type Props = {
  children: React.ReactNode;
};

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
        {isMobile && <ExpertNavLinks activeId={activeId} variant="tabs" />}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            overflow: "hidden",
            background: surface.card,
            border: border.line,
            borderRadius: radius.box,
            boxShadow: shadow.card,
          }}
        >
          {!isMobile && <ExpertNavLinks activeId={activeId} variant="sidebar" />}
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

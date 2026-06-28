"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { surface } from "@/lib/typography";

/** Max content width — matches mockup airy centered layout */
export const WORKSPACE_MAX_WIDTH = 1200;

type Props = {
  children: ReactNode;
  /** Omit horizontal padding (child sections manage their own) */
  flush?: boolean;
  style?: CSSProperties;
};

export function workspaceContentPadding(isMobile: boolean, flush?: boolean): string {
  if (flush) return "0";
  return isMobile ? "24px 16px 48px" : "32px 28px 48px";
}

/** Centered page column below the global top nav */
export function WorkspaceContent({ children, flush, style }: Props) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        width: "100%",
        maxWidth: WORKSPACE_MAX_WIDTH,
        margin: "0 auto",
        padding: workspaceContentPadding(isMobile, flush),
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Full-height scroll region with cream page background */
export const WorkspaceScroll = forwardRef<HTMLDivElement, { children: ReactNode; style?: CSSProperties }>(
  function WorkspaceScroll({ children, style }, ref) {
    return (
      <div
        ref={ref}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          background: surface.page,
          ...style,
        }}
      >
        {children}
      </div>
    );
  },
);

/** Centered sub-page shell (admin, expert profile, staff dashboard routes). */
export function WorkspaceSubpageShell({
  children,
  bruddle = false,
}: {
  children: ReactNode;
  bruddle?: boolean;
}) {
  return (
    <div
      className={bruddle ? "bruddle" : undefined}
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
        <WorkspaceContent>{children}</WorkspaceContent>
      </WorkspaceScroll>
    </div>
  );
}

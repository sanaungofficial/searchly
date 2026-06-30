"use client";

import type { CSSProperties } from "react";
import { DRAWER_BACKDROP_Z, DRAWER_NESTED_BACKDROP_Z } from "@/lib/z-layers";

type BackdropProps = {
  onClose: () => void;
  zIndex?: number;
  /** default = standard drawer dim; nested = above parent drawer; transparent = invisible but clickable */
  variant?: "default" | "nested" | "transparent";
  /** When false, clicks pass through (e.g. fade-out). Default true. */
  interactive?: boolean;
  style?: CSSProperties;
  className?: string;
};

/** Full-screen backdrop — click to close the drawer/modal it belongs to. */
export function ScoutDrawerBackdrop({
  onClose,
  zIndex,
  variant = "default",
  interactive = true,
  style,
  className,
}: BackdropProps) {
  const resolvedZ = zIndex ?? (variant === "nested" ? DRAWER_NESTED_BACKDROP_Z : DRAWER_BACKDROP_Z);
  const background =
    variant === "transparent"
      ? "transparent"
      : variant === "nested"
        ? "rgba(0,0,0,0.4)"
        : "rgba(0,0,0,0.18)";
  const { top, pointerEvents, ...restStyle } = style ?? {};

  return (
    <div
      role="presentation"
      aria-hidden
      onClick={interactive ? onClose : undefined}
      className={className}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: top ?? 0,
        background,
        zIndex: resolvedZ,
        cursor: interactive ? "pointer" : "default",
        pointerEvents: interactive ? pointerEvents ?? "auto" : "none",
        ...restStyle,
      }}
    />
  );
}

"use client";

import type { CSSProperties } from "react";
import { DRAWER_BACKDROP_Z, DRAWER_NESTED_BACKDROP_Z } from "@/lib/z-layers";

type BackdropProps = {
  onClose: () => void;
  zIndex?: number;
  /** default = standard drawer dim; nested = above parent drawer; transparent = invisible but clickable */
  variant?: "default" | "nested" | "transparent";
  style?: CSSProperties;
  className?: string;
};

/** Full-screen backdrop — click to close the drawer/modal it belongs to. */
export function ScoutDrawerBackdrop({
  onClose,
  zIndex,
  variant = "default",
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

  return (
    <div
      role="presentation"
      aria-hidden
      onClick={onClose}
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        background,
        zIndex: resolvedZ,
        cursor: "pointer",
        ...style,
      }}
    />
  );
}

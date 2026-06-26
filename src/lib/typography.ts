/** Kimchi typography — Source Sans 3 UI + Fraunces display */

import type { CSSProperties } from "react";

export const fontSans = "var(--font-ui)";
export const fontDisplay = "var(--font-display)";
export const fontMono = "var(--font-mono-ui)";

/** Fraunces editorial variation — match Citebound mockup */
export const displayVariation = '"opsz" 72, "WONK" 1' as const;

export const color = {
  ink: "#1A1A1A",
  forest: "#1A3A2F",
  stone: "#52493F",
  /** Body secondary — bumped from #6B6258 for AA on cream (~5.2:1) */
  muted: "#5C534A",
  mutedLight: "#8A8178",
  gold: "#E8D5A3",
  cream: "#F7F5F2",
} as const;

/** Source Sans 3 — Kimchi uses three weights only (no hairline/thin on UI) */
export const weight = {
  body: 400,
  medium: 500,
  semibold: 600,
  display: 500,
} as const;

export function displayTitleStyle(size: number, overrides?: CSSProperties): CSSProperties {
  return {
    fontFamily: fontDisplay,
    fontSize: size,
    fontWeight: 500,
    fontVariationSettings: displayVariation,
    color: color.ink,
    margin: 0,
    lineHeight: size >= 34 ? 0.94 : size >= 22 ? 1.12 : 1.2,
    letterSpacing: size >= 34 ? "-0.035em" : size >= 22 ? "-0.015em" : "-0.01em",
    ...overrides,
  };
}

/** Citebound-style surfaces — cream page, white cards */
export const surface = {
  page: "var(--scout-page)",
  card: "var(--scout-surface)",
  inset: "var(--scout-inset)",
  stackPlate: "var(--scout-stack-plate)",
} as const;

export const border = {
  line: "1px solid rgba(17,17,17,0.14)",
  lineStrong: "1px solid rgba(17,17,17,0.22)",
} as const;

/** Mobile-first type scale (px) — nothing below 12 for readable content */
export const type = {
  displayLg: 28,
  displaySm: 22,
  heading: 18,
  body: 15,
  bodySm: 14,
  caption: 13,
  label: 12,
  stat: 40,
} as const;

/** Drawers & modals — bumped one step for dense comparison UI */
export const drawerType = {
  hero: 26,
  title: 16,
  subtitle: 14,
  body: 14,
  caption: 13,
  label: 12,
  tableHeader: 13,
  tableCell: 14,
  chip: 13,
  button: 15,
} as const;

/** Kimchi typography — Roboto Flex UI + Newsreader headings inside `.bruddle` */

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
  cream: "var(--scout-cream)",
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

/** Bruddle heading scale — Newsreader Regular via `--font-display` inside `.bruddle` */
export type BruddleHeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export function bruddleHeadingStyle(
  level: BruddleHeadingLevel,
  overrides?: CSSProperties,
): CSSProperties {
  const size = type[level];
  return {
    fontFamily: fontDisplay,
    fontSize: size,
    fontWeight: 400,
    color: color.ink,
    margin: 0,
    lineHeight: size >= 36 ? 1.1 : size >= 24 ? 1.15 : 1.2,
    letterSpacing: "-0.01em",
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

/** Standard corner radius for cards, inputs, and buttons */
export const radius = {
  box: "var(--scout-radius)",
  px: 5,
} as const;

/** Soft elevation — white cards floating on cream page */
export const shadow = {
  card: "var(--scout-shadow-card)",
  cardStrong: "var(--scout-shadow-card-strong)",
} as const;

/**
 * Bruddle-aligned type scale (px).
 * Headings: Newsreader. UI/body: Roboto Flex.
 */
export const type = {
  h1: 48,
  h2: 36,
  h3: 30,
  h4: 24,
  h5: 20,
  h6: 18,
  body: 16,
  bodySm: 14,
  caption: 14,
  label: 12,
  btnLg: 16,
  btnMd: 14,
  btnSm: 12,
  /** Legacy aliases */
  displayLg: 30,
  displaySm: 24,
  heading: 18,
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

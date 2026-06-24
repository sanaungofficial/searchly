/** Kimchi typography — Source Sans 3 UI + Fraunces display */

export const fontSans = "var(--font-ui)";
export const fontDisplay = "var(--font-display)";
export const fontMono = "var(--font-mono-ui)";

export const color = {
  ink: "#1A1A1A",
  forest: "#1A3A2F",
  stone: "#52493F",
  muted: "#6B6258",
  mutedLight: "#A09890",
  gold: "#E8D5A3",
  cream: "#F7F5F2",
} as const;

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

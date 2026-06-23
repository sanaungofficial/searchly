/** Kimchi typography — Source Sans 3 UI + Cormorant display */

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

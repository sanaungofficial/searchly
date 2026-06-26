/**
 * Sidebar palette — forest green background with high-contrast cream/gold text.
 * Use solid colors (not low-opacity gold) so contrast stays readable on all displays.
 */

export const sidebarTheme = {
  bg: "#1A3A2F",
  gold: "#E8D5A3",
  cream: "#F5EFD8",
  creamBright: "#FFF8E7",

  /** Primary nav label — inactive */
  text: "#E8D5A3",
  /** Primary nav label — active / hover emphasis */
  textActive: "#FFF8E7",
  /** Secondary lines (tagline, captions) — still legible on forest */
  textMuted: "#C9BC98",
  /** Tertiary meta only (usage counts) */
  textSubtle: "#A89878",

  icon: "#E8D5A3",
  iconActive: "#FFF8E7",
  iconMuted: "#C9BC98",

  border: "1px solid rgba(232, 213, 163, 0.18)",
  borderStrong: "1px solid rgba(232, 213, 163, 0.42)",
  bgHover: "rgba(232, 213, 163, 0.08)",
  bgActive: "rgba(232, 213, 163, 0.14)",
} as const;

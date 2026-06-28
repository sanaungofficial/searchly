import type { CSSProperties } from "react";

/** Above sticky Continue/Back footer cards in onboarding question screens. */
export const ONBOARDING_ELEVATED_CARD_Z = 30;

/** Suggestion list above elevated card + footer within onboarding shell. */
export const ONBOARDING_AUTOCOMPLETE_DROPDOWN_Z = 100;

export function onboardingElevatedCardStyle(elevated: boolean): CSSProperties {
  return elevated ? { position: "relative", zIndex: ONBOARDING_ELEVATED_CARD_Z } : {};
}

export const onboardingAutocompleteListboxStyle: CSSProperties = {
  position: "absolute",
  zIndex: ONBOARDING_AUTOCOMPLETE_DROPDOWN_Z,
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  margin: 0,
  padding: 6,
  listStyle: "none",
  background: "#FFFFFF",
  border: "1px solid rgba(26,58,47,0.16)",
  borderRadius: "var(--scout-radius)",
  boxShadow: "0 8px 24px rgba(26,58,47,0.12)",
  maxHeight: 240,
  overflowY: "auto",
};

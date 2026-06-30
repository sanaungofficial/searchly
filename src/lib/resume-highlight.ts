import type { ReactNode } from "react";
import { createElement } from "react";

/** Light green highlight for injected / changed resume keywords (Jobright-style). */
export const RESUME_KEYWORD_HIGHLIGHT_BG = "rgba(134, 239, 172, 0.45)";

export function renderTextWithKeywords(
  text: string,
  keywords: string[],
  keyPrefix = "",
): ReactNode {
  if (!keywords.length || !text) return text;
  const escaped = keywords
    .filter(Boolean)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return text;
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const isKw = keywords.some((k) => k.toLowerCase() === part.toLowerCase());
    return isKw
      ? createElement(
          "mark",
          {
            key: `${keyPrefix}${i}`,
            style: {
              background: RESUME_KEYWORD_HIGHLIGHT_BG,
              color: "inherit",
              borderRadius: 2,
              padding: "0 1px",
            },
          },
          part,
        )
      : createElement("span", { key: `${keyPrefix}${i}` }, part);
  });
}

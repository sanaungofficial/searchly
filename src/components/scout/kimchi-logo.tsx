import type { CSSProperties } from "react";
import { KimchiBySecondLadder } from "@/components/scout/scout-box";
import { color, fontDisplay } from "@/lib/typography";

const LOGO_SRC = "/logo.svg";

type MarkProps = {
  size?: number;
  style?: CSSProperties;
  className?: string;
};

/** Kimchi mark only — rounded square with K */
export function KimchiLogoMark({ size = 28, style, className }: MarkProps) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
      aria-hidden
    />
  );
}

type WordmarkProps = {
  /** Logo mark size in px */
  markSize?: number;
  /** Wordmark title size in px */
  titleSize?: number;
  showTitle?: boolean;
  showTagline?: boolean;
  align?: "left" | "center";
  style?: CSSProperties;
};

/** Logo mark + optional Kimchi title and Second Ladder tagline */
export function KimchiWordmark({
  markSize = 32,
  titleSize = 22,
  showTitle = true,
  showTagline = false,
  align = "left",
  style,
}: WordmarkProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        gap: showTagline ? 4 : 0,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <KimchiLogoMark size={markSize} />
        {showTitle && (
          <span
            style={{
              fontFamily: fontDisplay,
              fontSize: titleSize,
              fontWeight: 500,
              color: color.ink,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Kimchi
          </span>
        )}
      </div>
      {showTagline && <KimchiBySecondLadder fontSize={12} color={color.muted} />}
    </div>
  );
}

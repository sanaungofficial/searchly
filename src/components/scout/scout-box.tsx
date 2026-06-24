import type { CSSProperties, ReactNode } from "react";
import { border, surface } from "@/lib/typography";

type ScoutBoxProps = {
  children: ReactNode;
  bg?: string;
  padding?: number | string;
  stack?: boolean;
  style?: CSSProperties;
  className?: string;
};

/** Bordered surface — white card on cream page by default */
export function ScoutBox({
  children,
  bg = surface.card,
  padding = 20,
  stack = false,
  style,
  className,
}: ScoutBoxProps) {
  if (!stack) {
    return (
      <div
        className={className}
        style={{
          background: bg,
          border: border.line,
          padding,
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={className} style={{ position: "relative", paddingRight: 3, paddingBottom: 3, ...style }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 3,
          top: 3,
          right: 0,
          bottom: 0,
          background: surface.stackPlate,
          border: border.line,
        }}
      />
      <div
        style={{
          position: "relative",
          background: bg,
          border: border.lineStrong,
          padding,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ScoutLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--scout-muted)",
      }}
    >
      {children}
    </span>
  );
}

export function ScoutDisplayTitle({
  children,
  size = 32,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-display)",
        fontSize: size,
        fontWeight: 500,
        fontVariationSettings: '"opsz" 72, "WONK" 1',
        color: "var(--scout-ink)",
        margin: 0,
        lineHeight: size >= 34 ? 0.94 : 1.12,
        letterSpacing: size >= 34 ? "-0.035em" : "-0.015em",
        ...style,
      }}
    >
      {children}
    </h2>
  );
}

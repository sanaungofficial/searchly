import type { CSSProperties, ReactNode } from "react";
import { border, surface, displayTitleStyle } from "@/lib/typography";

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

/** "by Second Ladder" tagline — title case, not all-caps */
export function KimchiBySecondLadder({
  color = "var(--scout-muted)",
  brandColor,
  fontSize = 12,
  marginTop,
  style,
}: {
  color?: string;
  brandColor?: string;
  fontSize?: number | string;
  marginTop?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--font-ui)",
        fontSize,
        fontWeight: 400,
        color,
        letterSpacing: "0.02em",
        marginTop,
        ...style,
      }}
    >
      by{" "}
      <span style={{ fontWeight: 500, color: brandColor ?? color }}>Second Ladder</span>
    </div>
  );
}

const btnBase: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 0,
};

export function ScoutPrimaryBtn({
  children,
  onClick,
  disabled,
  type = "button",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnBase,
        padding: "8px 16px",
        background: disabled ? "rgba(26,58,47,0.35)" : "var(--scout-forest)",
        color: "var(--scout-gold)",
        border: border.lineStrong,
        opacity: disabled ? 0.7 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function ScoutSecondaryBtn({
  children,
  onClick,
  disabled,
  active,
  type = "button",
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  type?: "button" | "submit";
  style?: CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnBase,
        padding: "8px 16px",
        background: active ? "var(--scout-forest)" : surface.card,
        color: active ? "var(--scout-gold)" : "var(--scout-forest)",
        border: border.lineStrong,
        ...style,
      }}
    >
      {children}
    </button>
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
    <h2 style={displayTitleStyle(size, style)}>
      {children}
    </h2>
  );
}

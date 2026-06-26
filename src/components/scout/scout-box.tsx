import type { CSSProperties, ReactNode } from "react";
import { border, color, radius, shadow, surface, displayTitleStyle } from "@/lib/typography";

type ScoutBoxProps = {
  children: ReactNode;
  bg?: string;
  padding?: number | string;
  /** Slightly stronger shadow for hero / featured cards (e.g. dashboard stat) */
  stack?: boolean;
  /** No shadow — nested panels, inset surfaces, or custom backgrounds */
  flat?: boolean;
  style?: CSSProperties;
  className?: string;
};

/** Bordered surface — white card on cream page with soft bottom elevation */
export function ScoutBox({
  children,
  bg = surface.card,
  padding = 20,
  stack = false,
  flat = false,
  style,
  className,
}: ScoutBoxProps) {
  return (
    <div
      className={className}
      style={{
        background: bg,
        border: border.line,
        borderRadius: radius.box,
        padding,
        boxShadow: flat ? undefined : stack ? shadow.cardStrong : shadow.card,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function ScoutLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.08em",
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
  borderRadius: radius.box,
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

/** Gold CTA — e.g. Make primary resume */
export function ScoutGoldBtn({
  children,
  onClick,
  disabled,
  type = "button",
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  style?: React.CSSProperties;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnBase,
        padding: "8px 16px",
        background: disabled ? "rgba(196,168,106,0.35)" : color.gold,
        color: color.forest,
        border: `1px solid ${color.forest}`,
        fontWeight: 700,
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

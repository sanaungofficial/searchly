import type { CSSProperties, ReactNode } from "react";
import { border, color, radius, shadow, surface, displayTitleStyle, type as T } from "@/lib/typography";

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
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
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
  onClick,
  role,
  tabIndex,
}: ScoutBoxProps) {
  return (
    <div
      className={className}
      role={role}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        background: bg,
        border: "var(--scout-border)",
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

/** Standard bordered form control — matches ScoutBox radius */
export const scoutFieldStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "var(--scout-border)",
  borderRadius: radius.box,
  fontFamily: "var(--font-ui)",
  fontSize: T.bodySm,
  color: color.ink,
  background: surface.card,
  boxSizing: "border-box",
};

/** Small category / status chip on inset background */
export const scoutInsetChipStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 12,
  color: color.muted,
  background: surface.inset,
  padding: "4px 8px",
  border: "var(--scout-border)",
  borderRadius: radius.box,
};

/** Inset callout panel inside a ScoutBox */
export const scoutInsetPanelStyle: CSSProperties = {
  background: surface.inset,
  border: "var(--scout-border)",
  borderRadius: radius.box,
};

export function ScoutInsetBox({
  children,
  padding = "10px 12px",
  style,
}: {
  children: ReactNode;
  padding?: number | string;
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...scoutInsetPanelStyle, padding, ...style }}>
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
  fontSize: T.btnMd,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  borderRadius: radius.box,
};

/** Bruddle primary CTA — purple fill, ink text, scout border, offset shadow */
export const scoutPrimaryCtaStyle: CSSProperties = {
  background: "var(--scout-cta)",
  color: "var(--scout-cta-foreground)",
  border: "var(--scout-border)",
  boxShadow: "var(--scout-shadow-bruddle)",
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
        ...scoutPrimaryCtaStyle,
        background: disabled ? "var(--scout-cta-muted)" : scoutPrimaryCtaStyle.background,
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
        background: active ? color.bruddleInk : surface.card,
        color: active ? "#FFFFFF" : color.bruddleInk,
        border: "var(--scout-border)",
        boxShadow: active ? undefined : "var(--scout-shadow-bruddle)",
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

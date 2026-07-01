"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  DEFAULT_PIPELINE_TAG,
  type PipelineTagColor,
  type PipelineTagVariant,
} from "@/lib/pipeline-tags";
import { fontSans } from "@/lib/typography";

export type { PipelineTagColor, PipelineTagVariant };

const INK = "#161616";

const PALETTE: Record<
  PipelineTagColor,
  Record<PipelineTagVariant, { bg: string; color: string; border: string }>
> = {
  purple: {
    light: { bg: "rgba(174,122,255,0.14)", color: INK, border: INK },
    solid: { bg: "var(--bruddle-purple)", color: INK, border: INK },
  },
  green: {
    light: { bg: "rgba(152,233,171,0.28)", color: INK, border: INK },
    solid: { bg: "var(--bruddle-green)", color: INK, border: INK },
  },
  gray: {
    light: { bg: "rgba(95,100,109,0.08)", color: "#5F646D", border: INK },
    solid: { bg: "#F0ECE6", color: INK, border: INK },
  },
  salmon: {
    light: { bg: "rgba(233,152,152,0.22)", color: INK, border: INK },
    solid: { bg: "var(--bruddle-red)", color: INK, border: INK },
  },
  yellow: {
    light: { bg: "rgba(250,232,164,0.55)", color: INK, border: INK },
    solid: { bg: "var(--bruddle-cream)", color: INK, border: INK },
  },
  black: {
    light: { bg: "rgba(22,22,22,0.06)", color: INK, border: INK },
    solid: { bg: INK, color: "#FAF4F0", border: INK },
  },
};

export const PIPELINE_TAG_COLORS: PipelineTagColor[] = [
  "purple",
  "green",
  "gray",
  "salmon",
  "yellow",
  "black",
];

export function pipelineTagStyles(
  color: PipelineTagColor = DEFAULT_PIPELINE_TAG.color,
  variant: PipelineTagVariant = DEFAULT_PIPELINE_TAG.variant,
  compact?: boolean,
): CSSProperties {
  const tone = PALETTE[color][variant];
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: compact ? 4 : 6,
    fontFamily: fontSans,
    fontSize: compact ? 11 : 12,
    fontWeight: 600,
    lineHeight: 1.2,
    color: tone.color,
    background: tone.bg,
    border: `1.5px solid ${tone.border}`,
    borderRadius: 4,
    padding: compact ? "3px 7px" : "4px 9px",
    boxSizing: "border-box",
  };
}

export type PipelineTagProps = {
  label: string;
  color?: PipelineTagColor;
  variant?: PipelineTagVariant;
  /** Removable chip — X icon on the left */
  removable?: boolean;
  /** Removable X button styling */
  removeVariant?: "fill" | "outline";
  /** Purple dot before label */
  dot?: boolean;
  /** Count badge (purple square) instead of a text chip */
  count?: number;
  compact?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
};

function RemoveButton({
  label,
  variant,
  compact,
  onRemove,
}: {
  label: string;
  variant: "fill" | "outline";
  compact?: boolean;
  onRemove: () => void;
}) {
  const filled = variant === "fill";
  return (
    <button
      type="button"
      aria-label={`Remove ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: compact ? 14 : 16,
        height: compact ? 14 : 16,
        flexShrink: 0,
        margin: 0,
        padding: 0,
        border: filled ? "none" : "1.5px solid #FAF4F0",
        borderRadius: 2,
        background: filled ? INK : "transparent",
        color: filled ? "#FAF4F0" : "#FAF4F0",
        fontFamily: fontSans,
        fontSize: compact ? 11 : 12,
        lineHeight: 1,
        cursor: "pointer",
      }}
    >
      ×
    </button>
  );
}

function TagLabel({ label, onClick }: { label: string; onClick?: () => void }) {
  if (!onClick) return <span>{label}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export function PipelineTag({
  label,
  color = DEFAULT_PIPELINE_TAG.color,
  variant = DEFAULT_PIPELINE_TAG.variant,
  removable,
  removeVariant = "fill",
  dot,
  count,
  compact,
  onRemove,
  onClick,
}: PipelineTagProps) {
  if (count != null) {
    return (
      <span
        aria-label={`${label}: ${count}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: compact ? 18 : 22,
          height: compact ? 18 : 22,
          padding: "0 4px",
          fontFamily: fontSans,
          fontSize: compact ? 10 : 11,
          fontWeight: 700,
          color: "#FAF4F0",
          background: "var(--bruddle-purple)",
          border: `1.5px solid ${INK}`,
          borderRadius: 3,
        }}
      >
        {count}
      </span>
    );
  }

  const content: ReactNode = (
    <>
      {removable && onRemove && (
        <RemoveButton
          label={label}
          variant={removeVariant}
          compact={compact}
          onRemove={onRemove}
        />
      )}
      {dot && (
        <span
          aria-hidden
          style={{
            width: compact ? 5 : 6,
            height: compact ? 5 : 6,
            borderRadius: "50%",
            background: "var(--bruddle-purple)",
            flexShrink: 0,
          }}
        />
      )}
      <TagLabel label={label} onClick={onClick} />
    </>
  );

  return (
    <span style={pipelineTagStyles(color, variant, compact)}>
      {content}
    </span>
  );
}

export function PipelineTagColorSwatch({
  color,
  selected,
  onClick,
  disabled,
}: {
  color: PipelineTagColor;
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const tone = PALETTE[color].solid;
  return (
    <button
      type="button"
      aria-label={`${color} tag color`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        border: selected ? `2.5px solid ${INK}` : `1.5px solid ${INK}`,
        background: tone.bg,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: selected ? "2px 2px 0 #161616" : "none",
        padding: 0,
      }}
    />
  );
}

"use client";

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHoverCapable } from "@/hooks/use-hover-capable";
import { matchScoreStyle } from "@/lib/match-score";
import {
  discoveryBreakdownRows,
  tierLabel,
  type DiscoveryScoreBreakdown,
  type DiscoveryScoreResult,
} from "@/lib/discovery-score";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";
import { ScoreExplainerPopover } from "@/components/scout/score-explainer-popover";

/** Bruddle score chip — same footprint as Opportunities `MatchScoreBadge`. */
export function DiscoveryScoreBadge({ score, label }: { score: number; label: string }) {
  const style = matchScoreStyle(score);
  return (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      <div
        style={{
          width: 52,
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: style.bg,
          border: `2px solid ${style.accent}`,
          borderRadius: "var(--scout-radius)",
        }}
      >
        <span style={{ fontFamily: fontMono, fontSize: 20, fontWeight: 700, color: style.accent, lineHeight: 1 }}>
          {score}
        </span>
      </div>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 600,
          color: style.accent,
          margin: "6px 0 0",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </p>
    </div>
  );
}

function BreakdownPanel({
  breakdown,
  summary,
  topImprovement,
}: {
  breakdown: DiscoveryScoreBreakdown;
  summary?: string;
  topImprovement?: string;
}) {
  const rows = discoveryBreakdownRows(breakdown);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const style = matchScoreStyle(total);

  return (
    <>
      <p
        style={{
          margin: "0 0 2px",
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: color.muted,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        Why this score
      </p>
      <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: T.caption, color: color.stone, lineHeight: 1.45 }}>
        {summary?.trim() || "Four dimensions — each worth up to 25 points."}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((row) => (
          <li key={row.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.ink }}>
                {row.label}
              </span>
              <span style={{ fontFamily: fontMono, fontSize: T.label, fontWeight: 700, color: style.accent, flexShrink: 0 }}>
                {row.value}
                <span style={{ color: color.muted, fontWeight: 500 }}>/{row.max}</span>
              </span>
            </div>
            <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 11, color: color.muted, lineHeight: 1.45 }}>
              {row.description}
            </p>
            <div style={{ height: 3, borderRadius: "var(--scout-radius)", background: surface.inset, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${(row.value / row.max) * 100}%`,
                  background: style.accent,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {topImprovement?.trim() && (
        <p
          style={{
            margin: "12px 0 0",
            paddingTop: 10,
            borderTop: border.line,
            fontFamily: fontSans,
            fontSize: T.caption,
            color: color.ink,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 700, color: color.forest }}>Top move: </span>
          {topImprovement}
        </p>
      )}
    </>
  );
}

/** Hover popover on the score badge — personalized breakdown (Opportunities "Why Match" pattern). */
export function DiscoveryScoreBreakdownPopover({
  score,
  breakdown,
  summary,
  topImprovement,
  align = "left",
  children,
}: {
  score: number;
  breakdown?: DiscoveryScoreBreakdown | null;
  summary?: string;
  topImprovement?: string;
  align?: "left" | "right";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hoverCapable = useHoverCapable();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (!hoverCapable) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearCloseTimer, hoverCapable]);

  const show = useCallback(() => {
    if (!hoverCapable || !breakdown) return;
    clearCloseTimer();
    setOpen(true);
  }, [breakdown, clearCloseTimer, hoverCapable]);

  if (!breakdown || score <= 0) {
    return <>{children}</>;
  }

  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", verticalAlign: "middle" }}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Discovery score ${score} — hover for breakdown`}
            aria-expanded={open}
            onMouseEnter={show}
            onMouseLeave={scheduleClose}
            onClick={(e) => {
              e.stopPropagation();
              if (!hoverCapable) setOpen((v) => !v);
            }}
            style={{
              display: "inline-flex",
              padding: 0,
              background: "transparent",
              border: "none",
              cursor: hoverCapable ? "default" : "pointer",
              lineHeight: 0,
            }}
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={align === "right" ? "end" : "start"}
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={show}
          onMouseLeave={scheduleClose}
          className="rounded-[var(--scout-radius)] border-0 bg-transparent p-0 shadow-none outline-none"
          style={{
            width: 320,
            maxWidth: "min(320px, calc(100vw - 24px))",
            zIndex: 10000,
            background: surface.card,
            border: border.lineStrong,
            boxShadow: "4px 4px 0 rgba(17,17,17,0.08)",
            padding: "14px 16px 12px",
            borderRadius: "var(--scout-radius)",
          }}
        >
          <BreakdownPanel breakdown={breakdown} summary={summary} topImprovement={topImprovement} />
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** Score badge + methodology eye + hover breakdown — mirrors `CoachMatchScoreCluster`. */
export function DiscoveryScoreCluster({
  result,
  score,
  align = "right",
}: {
  result: DiscoveryScoreResult | null;
  score: number;
  align?: "left" | "right";
}) {
  if (score <= 0) return null;
  const label = result ? tierLabel(result.tier) : matchScoreStyle(score).label;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "right" ? "flex-end" : "flex-start",
        gap: 4,
        flexShrink: 0,
      }}
    >
      <ScoreExplainerPopover variant="discovery-score" align={align} />
      <DiscoveryScoreBreakdownPopover
        score={score}
        breakdown={result?.breakdown}
        summary={result?.summary}
        topImprovement={result?.topImprovement}
        align={align}
      >
        <DiscoveryScoreBadge score={score} label={label} />
      </DiscoveryScoreBreakdownPopover>
    </div>
  );
}

/** Foundation metric card hover — shows dimension detail when breakdown data exists. */
export function FoundationMetricWhyPopover({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hoverCapable = useHoverCapable();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (!hoverCapable) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearCloseTimer, hoverCapable]);

  const show = useCallback(() => {
    if (!hoverCapable) return;
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer, hoverCapable]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={show}
          onMouseLeave={scheduleClose}
          onClick={() => {
            if (!hoverCapable) setOpen((v) => !v);
          }}
          style={{ cursor: hoverCapable ? "default" : "pointer" }}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={6}
        collisionPadding={12}
        avoidCollisions
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        className="rounded-[var(--scout-radius)] border-0 bg-transparent p-0 shadow-none outline-none"
        style={{
          width: 280,
          maxWidth: "min(280px, calc(100vw - 24px))",
          zIndex: 10000,
          background: surface.card,
          border: border.lineStrong,
          boxShadow: "4px 4px 0 rgba(17,17,17,0.08)",
          padding: "12px 14px",
          borderRadius: "var(--scout-radius)",
        }}
      >
        <p
          style={{
            margin: "0 0 4px",
            fontFamily: fontSans,
            fontSize: T.label,
            fontWeight: 700,
            color: color.forest,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {title}
        </p>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.ink, lineHeight: 1.5 }}>
          {body}
        </p>
      </PopoverContent>
    </Popover>
  );
}

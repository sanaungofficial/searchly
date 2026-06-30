"use client";

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHoverCapable } from "@/hooks/use-hover-capable";
import { isLowQualityMatchReason } from "@/lib/match-score";
import { fontSans, fontMono, color, surface, border, type as T } from "@/lib/typography";
import { JR } from "@/lib/opportunities-jobright-tokens";

const MATCH_RING = JR.mint;

export function matchScorePanelBackground(score: number): string {
  if (score >= 75) return JR.matchPanelHigh;
  if (score >= 60) return JR.matchPanelMid;
  return JR.matchPanelLow;
}

export function filterMatchReasons(reasons: string[], max = 4): string[] {
  return reasons.filter((r) => r && !isLowQualityMatchReason(r)).slice(0, max);
}

export function CircularMatchScore({ score }: { score: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  return (
    <div style={{ position: "relative", width: 80, height: 80 }}>
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ display: "block" }}>
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={MATCH_RING}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: fontMono, fontSize: 17, fontWeight: 700, color: "#FFFFFF", lineHeight: 1 }}>
          {score}<span style={{ fontSize: 11 }}>%</span>
        </span>
      </div>
    </div>
  );
}

export function WhyMatchPanel({
  reasons,
  matchedSkills,
  title = "Why This Job Is A Match",
  matchedSkillsLabel = "Matched Skills",
}: {
  reasons: string[];
  matchedSkills: string[];
  title?: string;
  matchedSkillsLabel?: string;
}) {
  return (
    <div style={{ padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
          <path d="M7.5 1L9 6H14.5L10 9.5L11.5 14.5L7.5 11.5L3.5 14.5L5 9.5L0.5 6H6L7.5 1Z" fill={MATCH_RING} stroke={MATCH_RING} strokeWidth="0.5" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink }}>
          {title}
        </span>
      </div>
      {reasons.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: matchedSkills.length > 0 ? 14 : 0 }}>
          {reasons.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <span style={{ color: MATCH_RING, fontSize: 13, lineHeight: "1.45", flexShrink: 0, fontWeight: 700 }}>✓</span>
              <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.45 }}>{r}</span>
            </div>
          ))}
        </div>
      )}
      {matchedSkills.length > 0 && (
        <div>
          <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 7px" }}>
            {matchedSkillsLabel}
          </p>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {matchedSkills.map((skill) => (
              <span key={skill} style={{ display: "inline-block", padding: "3px 10px", fontSize: T.label, fontWeight: 600, color: MATCH_RING, background: JR.mintTintStrong, border: `1px solid ${JR.mintBorder}`, borderRadius: 4 }}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MatchWhyScorePopover({
  reasons,
  matchedSkills,
  whyTitle,
  matchedSkillsLabel,
  children,
}: {
  reasons: string[];
  matchedSkills: string[];
  whyTitle?: string;
  matchedSkillsLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hoverCapable = useHoverCapable();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasContent = reasons.length > 0 || matchedSkills.length > 0;

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
    if (!hoverCapable || !hasContent) return;
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer, hasContent, hoverCapable]);

  if (!hasContent) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <div
          onMouseEnter={show}
          onMouseLeave={scheduleClose}
          onClick={(e) => {
            e.stopPropagation();
            if (!hoverCapable) setOpen((v) => !v);
          }}
          style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: hoverCapable ? "default" : "pointer" }}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="left"
        sideOffset={8}
        collisionPadding={12}
        avoidCollisions
        onOpenAutoFocus={(e) => e.preventDefault()}
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        className="rounded-[var(--scout-radius)] border-0 bg-transparent p-0 shadow-none outline-none"
        style={{
          width: 320,
          maxWidth: "min(320px, calc(100vw - 24px))",
          maxHeight: 280,
          overflowY: "auto",
          zIndex: 10000,
          background: surface.card,
          border: border.lineStrong,
          boxShadow: "4px 4px 0 rgba(17,17,17,0.08)",
          padding: "14px 16px 12px",
          borderRadius: "var(--scout-radius)",
        }}
      >
        <WhyMatchPanel
          reasons={reasons}
          matchedSkills={matchedSkills}
          title={whyTitle}
          matchedSkillsLabel={matchedSkillsLabel}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Dark right-column score panel — same layout as Opportunities recommended job cards. */
export function MatchScoreColumn({
  score,
  label,
  reasons,
  matchedSkills,
  whyTitle = "Why This Job Is A Match",
  matchedSkillsLabel = "Matched Skills",
  width = 120,
}: {
  score: number;
  label: string;
  reasons?: string[];
  matchedSkills?: string[];
  whyTitle?: string;
  matchedSkillsLabel?: string;
  width?: number;
}) {
  if (score <= 0) return null;

  const filteredReasons = filterMatchReasons(reasons ?? []);
  const skills = (matchedSkills ?? []).slice(0, 6);
  const panelBg = matchScorePanelBackground(score);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      style={{
        width,
        flexShrink: 0,
        alignSelf: "stretch",
        background: panelBg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderLeft: "none",
        borderRadius: "0 16px 16px 0",
      }}
    >
      <MatchWhyScorePopover
        reasons={filteredReasons}
        matchedSkills={skills}
        whyTitle={whyTitle}
        matchedSkillsLabel={matchedSkillsLabel}
      >
        <CircularMatchScore score={score} />
        <p
          style={{
            fontFamily: fontSans,
            fontSize: 10,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            textAlign: "center",
            margin: 0,
            padding: "0 8px 20px",
          }}
        >
          {label ? `${label.toUpperCase()} MATCH` : "MATCH"}
        </p>
      </MatchWhyScorePopover>
    </div>
  );
}

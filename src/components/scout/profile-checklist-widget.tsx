"use client";

import { useMemo, useState } from "react";
import {
  computeSearchReadiness,
  type SearchReadinessInput,
} from "@/lib/search-readiness-score";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  profile: SearchReadinessInput;
  onNavigateToTab: (tab: string) => void;
};

function CompletionRing({ pct, size }: { pct: number; size: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const ringColor = pct >= 80 ? "#1A3A2F" : pct >= 50 ? "#C4A86A" : "#C4574A";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(17,17,17,0.1)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

export function ProfileChecklistWidget({ profile, onNavigateToTab }: Props) {
  const [expanded, setExpanded] = useState(false);
  const result = useMemo(() => computeSearchReadiness(profile), [profile]);

  const completedCount = result.breakdown.filter((i) => i.complete).length;
  const totalCount = result.breakdown.length;
  const pct = Math.round((completedCount / totalCount) * 100);

  if (pct >= 100) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 50,
        maxWidth: 380,
        width: expanded ? "calc(100vw - 40px)" : "auto",
      }}
    >
      {/* Expanded panel */}
      {expanded && (
        <div
          style={{
            background: surface.card,
            border: border.line,
            borderRadius: "var(--scout-radius)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            marginBottom: 8,
            overflow: "hidden",
            animation: "fadeIn 0.2s ease both",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 18px",
              borderBottom: border.line,
              background: surface.inset,
            }}
          >
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.bodySm,
                fontWeight: 600,
                color: color.ink,
                margin: "0 0 4px",
              }}
            >
              Complete your profile
            </p>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.muted,
                lineHeight: 1.5,
                margin: "0 0 12px",
              }}
            >
              Finish these steps to improve your search readiness and get better matches.
            </p>
            {/* Progress bar */}
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "rgba(17,17,17,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: pct >= 80 ? "#1A3A2F" : pct >= 50 ? "#C4A86A" : "#C4574A",
                  borderRadius: 3,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          </div>

          {/* Checklist items */}
          <div style={{ padding: "8px 0", maxHeight: 340, overflowY: "auto" }}>
            {result.breakdown.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!item.complete) onNavigateToTab(item.tab);
                }}
                disabled={item.complete}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "12px 18px",
                  border: "none",
                  background: "transparent",
                  cursor: item.complete ? "default" : "pointer",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: item.complete ? color.muted : color.ink,
                  textAlign: "left",
                  textDecoration: item.complete ? "line-through" : "none",
                  opacity: item.complete ? 0.6 : 1,
                }}
              >
                {/* Checkbox circle */}
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: item.complete ? "none" : "2px solid rgba(17,17,17,0.2)",
                    background: item.complete ? color.forest : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "#fff",
                    fontSize: 12,
                  }}
                >
                  {item.complete && "✓"}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {!item.complete && (
                  <span
                    style={{
                      fontSize: T.label,
                      color: color.muted,
                      flexShrink: 0,
                    }}
                  >
                    +{item.maxPoints}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed trigger button */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px 10px 10px",
          background: surface.card,
          border: border.line,
          borderRadius: "var(--scout-radius)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)",
          cursor: "pointer",
          marginLeft: "auto",
        }}
      >
        {/* Mini ring */}
        <div style={{ position: "relative", width: 32, height: 32 }}>
          <CompletionRing pct={pct} size={32} />
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontFamily: fontSans,
              fontSize: 9,
              fontWeight: 700,
              color: color.ink,
            }}
          >
            {pct}%
          </span>
        </div>
        <span
          style={{
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            color: color.ink,
          }}
        >
          Complete profile
        </span>
        <span
          style={{
            fontFamily: fontSans,
            fontSize: T.caption,
            color: color.muted,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        >
          ▲
        </span>
      </button>
    </div>
  );
}

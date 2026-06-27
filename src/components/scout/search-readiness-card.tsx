"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  computeSearchReadiness,
  topIncompleteItems,
  type SearchReadinessInput,
} from "@/lib/search-readiness-score";
import { ScoutBox, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { border, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  profile: SearchReadinessInput & { avatarUrl?: string | null };
  isMobile: boolean;
  onNavigateToTab: (tab: string) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function ScoreRing({
  score,
  size,
  strokeWidth,
  tier,
}: {
  score: number;
  size: number;
  strokeWidth: number;
  tier: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const tierColor =
    tier === "ready"
      ? "#1A3A2F"
      : tier === "strong"
        ? "#2D6B4A"
        : tier === "building"
          ? "#C4A86A"
          : "#C4574A";

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(17,17,17,0.08)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={tierColor}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
    </svg>
  );
}

export function SearchReadinessCard({ profile, isMobile, onNavigateToTab }: Props) {
  const result = useMemo(() => computeSearchReadiness(profile), [profile]);
  const topActions = useMemo(() => topIncompleteItems(result, 3), [result]);

  const tierColor =
    result.tier === "ready"
      ? "#1A3A2F"
      : result.tier === "strong"
        ? "#2D6B4A"
        : result.tier === "building"
          ? "#C4A86A"
          : "#C4574A";

  const ringSize = isMobile ? 120 : 140;

  return (
    <ScoutBox
      padding={0}
      stack
      style={{ overflow: "hidden" }}
    >
      {/* Score hero */}
      <div
        style={{
          padding: isMobile ? "24px 20px 20px" : "28px 28px 24px",
          display: "flex",
          alignItems: isMobile ? "center" : "center",
          gap: isMobile ? 20 : 28,
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        {/* Score ring with avatar */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <ScoreRing
            score={result.score}
            size={ringSize}
            strokeWidth={8}
            tier={result.tier}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
            }}
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                style={{
                  width: isMobile ? 60 : 72,
                  height: isMobile ? 60 : 72,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: isMobile ? 60 : 72,
                  height: isMobile ? 60 : 72,
                  borderRadius: "50%",
                  background: "rgba(74,139,106,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: fontSans,
                  fontSize: 22,
                  fontWeight: 600,
                  color: color.forest,
                }}
              >
                {initials(profile.name ?? "?")}
              </div>
            )}
          </div>
        </div>

        {/* Score text */}
        <div style={{ textAlign: isMobile ? "center" : "left", flex: 1 }}>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: color.muted,
              margin: "0 0 6px",
            }}
          >
            Search Readiness
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: isMobile ? "center" : "flex-start" }}>
            <span style={displayTitleStyle(isMobile ? 44 : 52)}>
              {result.score}
            </span>
            <span
              style={{
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.muted,
                fontWeight: 500,
              }}
            >
              / 100
            </span>
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              padding: "4px 10px",
              background: `${tierColor}12`,
              borderRadius: "var(--scout-radius)",
              border: `1px solid ${tierColor}30`,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: tierColor,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: fontSans,
                fontSize: T.caption,
                fontWeight: 600,
                color: tierColor,
              }}
            >
              {result.tierLabel}
            </span>
          </div>
          {result.score < 100 && (
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.muted,
                lineHeight: 1.5,
                margin: "10px 0 0",
              }}
            >
              Complete your profile to improve your score and get better job matches.
            </p>
          )}
        </div>
      </div>

      {/* Top actions to boost score */}
      {topActions.length > 0 && (
        <div
          style={{
            borderTop: border.line,
            padding: isMobile ? "16px 20px 20px" : "18px 28px 24px",
          }}
        >
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              color: color.ink,
              margin: "0 0 10px",
            }}
          >
            Boost your score
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topActions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigateToTab(item.tab)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  padding: "10px 12px",
                  border: border.line,
                  borderRadius: "var(--scout-radius)",
                  background: surface.inset,
                  cursor: "pointer",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.ink,
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "2px solid rgba(17,17,17,0.2)",
                      flexShrink: 0,
                    }}
                  />
                  {item.label}
                </span>
                <span
                  style={{
                    fontFamily: fontSans,
                    fontSize: T.label,
                    fontWeight: 600,
                    color: color.forest,
                    flexShrink: 0,
                  }}
                >
                  +{item.maxPoints} pts
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </ScoutBox>
  );
}

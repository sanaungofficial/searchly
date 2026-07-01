"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ScoutBox, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { ScoutModal } from "@/components/scout/scout-modal";
import { useDiscoveryScore } from "@/hooks/use-discovery-score";
import { bruddleHeadingStyle, color, fontSans, fontDisplay, surface, type as T } from "@/lib/typography";
import { tierLabel } from "@/lib/discovery-score";

type Props = {
  isMobile: boolean;
  withClientScope: (path: string) => string;
};

type ProfileSnapshot = {
  name: string;
  avatarUrl: string | null;
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return <>{init}</>;
}

export function DiscoveryScoreCard({ isMobile, withClientScope }: Props) {
  const { result, loading, refreshing, refresh } = useDiscoveryScore({ withClientScope });
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  useEffect(() => {
    fetch(withClientScope("/api/profile"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.error) return;
        setProfile({ name: data.name ?? "You", avatarUrl: data.avatarUrl ?? null });
      })
      .catch(() => {});
  }, [withClientScope]);

  const score = result?.score ?? null;
  const tier = result?.tier ?? "low";
  const label = tierLabel(tier);

  const scoreColor =
    tier === "top" ? "#1A3A2F" :
    tier === "strong" ? "#2D6A4F" :
    tier === "building" ? "#C4A86A" :
    "#8A8178";

  const showLoader = loading || refreshing;
  const name = profile?.name ?? "You";

  return (
    <>
      <ScoutBox
        padding={isMobile ? "20px 18px" : "24px 28px"}
        style={{
          background: "linear-gradient(135deg, var(--scout-surface) 0%, rgba(26,58,47,0.04) 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 16 : 24,
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          <div
            style={{
              width: isMobile ? 56 : 68,
              height: isMobile ? 56 : 68,
              borderRadius: "50%",
              background: color.forest,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fontSans,
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
              flexShrink: 0,
              overflow: "hidden",
              border: "3px solid rgba(26,58,47,0.15)",
            }}
          >
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Initials name={name} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.label,
                color: color.muted,
                margin: "0 0 4px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Discovery Score
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              {showLoader ? (
                <span style={{ fontFamily: fontDisplay, fontSize: isMobile ? T.h2 : T.h1, fontWeight: 400, color: color.ink, lineHeight: 1 }}>
                  —
                </span>
              ) : score != null ? (
                <>
                  <span style={{ fontFamily: fontDisplay, fontSize: isMobile ? T.h2 : T.h1, fontWeight: 400, color: scoreColor, lineHeight: 1 }}>
                    {score}
                  </span>
                  <span style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, fontWeight: 600 }}>
                    /100
                  </span>
                  <span
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.btnSm,
                      fontWeight: 700,
                      color: scoreColor,
                      background:
                        tier === "top"
                          ? "rgba(26,58,47,0.08)"
                          : tier === "strong"
                            ? "rgba(45,106,79,0.08)"
                            : "rgba(196,168,106,0.12)",
                      padding: "3px 10px",
                      borderRadius: "var(--scout-radius)",
                      marginLeft: 4,
                    }}
                  >
                    {label}
                  </span>
                </>
              ) : (
                <span style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted }}>
                  Refresh to see your score
                </span>
              )}
            </div>
            {result?.summary && !showLoader && (
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: "8px 0 0" }}>
                {result.summary}
              </p>
            )}
          </div>

          {!isMobile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, alignItems: "flex-end" }}>
              <ScoutSecondaryBtn onClick={() => void refresh()} disabled={showLoader} style={{ minHeight: 42 }}>
                {showLoader ? "…" : "Refresh"}
              </ScoutSecondaryBtn>
              <Link
                href={withClientScope("/profile/discovery-score")}
                style={{
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.muted,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                View full report
              </Link>
            </div>
          )}
        </div>

        {isMobile && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <ScoutSecondaryBtn onClick={() => void refresh()} disabled={showLoader} style={{ width: "100%" }}>
              {showLoader ? "Refreshing…" : "Refresh score"}
            </ScoutSecondaryBtn>
            <Link
              href={withClientScope("/profile/discovery-score")}
              style={{
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.muted,
                textAlign: "center",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              View full report
            </Link>
          </div>
        )}

        {result && !showLoader && (
          <div style={{ marginTop: 20, borderTop: "var(--scout-border)", paddingTop: 16 }}>
            <div style={{ display: "flex", gap: isMobile ? 8 : 12, flexWrap: "wrap" }}>
              {[
                { label: "Resume", val: result.breakdown.resumeStrength },
                { label: "Positioning", val: result.breakdown.positioningClarity },
                { label: "Market Fit", val: result.breakdown.marketReadiness },
                { label: "Signals", val: result.breakdown.competitiveSignals },
              ].map((dim) => (
                <div key={dim.label} style={{ flex: "1 1 80px", minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted }}>{dim.label}</span>
                    <span style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.ink }}>
                      {dim.val}
                      <span style={{ color: color.muted, fontWeight: 400 }}>/25</span>
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: "var(--scout-radius)", background: surface.inset, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${(dim.val / 25) * 100}%`,
                        background: scoreColor,
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScoutBox>

      {whyOpen && (
        <ScoutModal open={whyOpen} bruddle onClose={() => setWhyOpen(false)} ariaLabelledBy="discovery-why-title" maxWidth={520}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p id="discovery-why-title" style={{ ...bruddleHeadingStyle("h4"), margin: "0 0 4px" }}>
              Why is this score important?
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, lineHeight: 1.65, margin: 0 }}>
              Your Discovery Score compares your profile against real professionals targeting similar roles — not a self-assessment.
            </p>
          </div>
        </ScoutModal>
      )}
    </>
  );
}

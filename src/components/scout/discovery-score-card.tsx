"use client";

import { useEffect, useRef, useState } from "react";
import { ScoutBox, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { ScoutModal } from "@/components/scout/scout-modal";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { bruddleHeadingStyle, color, fontSans, fontDisplay, surface, type as T } from "@/lib/typography";
import type { DiscoveryScoreInput, DiscoveryScoreResult } from "@/lib/discovery-score";
import { tierLabel } from "@/lib/discovery-score";

type Props = {
  input: DiscoveryScoreInput;
  avatarUrl: string | null;
  isMobile: boolean;
  withClientScope: (path: string) => string;
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return <>{init}</>;
}

export function DiscoveryScoreCard({ input, avatarUrl, isMobile, withClientScope }: Props) {
  const [result, setResult] = useState<DiscoveryScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [whyOpen, setWhyOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetch(withClientScope("/api/discovery-score"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.score === "number") {
          setResult(data as DiscoveryScoreResult);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [input, withClientScope]);

  const score = result?.score ?? 0;
  const tier = result?.tier ?? "low";
  const label = tierLabel(tier);

  const scoreColor =
    tier === "top" ? "#1A3A2F" :
    tier === "strong" ? "#2D6A4F" :
    tier === "building" ? "#C4A86A" :
    "#8A8178";

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
          {/* Avatar */}
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
            {avatarUrl ? (
              <img src={avatarUrl} alt={input.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Initials name={input.name} />
            )}
          </div>

          {/* Score number + label */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: "0 0 4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Discovery Score
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              {loading ? (
                <span style={{ fontFamily: fontDisplay, fontSize: isMobile ? T.h2 : T.h1, fontWeight: 400, color: color.ink, lineHeight: 1 }}>
                  —
                </span>
              ) : (
                <>
                  <span style={{ fontFamily: fontDisplay, fontSize: isMobile ? T.h2 : T.h1, fontWeight: 400, color: scoreColor, lineHeight: 1 }}>
                    {score}
                  </span>
                  <span style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, fontWeight: 600 }}>
                    pts
                  </span>
                  <span
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.btnSm,
                      fontWeight: 700,
                      color: scoreColor,
                      background: tier === "top" ? "rgba(26,58,47,0.08)" : tier === "strong" ? "rgba(45,106,79,0.08)" : "rgba(196,168,106,0.12)",
                      padding: "3px 10px",
                      borderRadius: "var(--scout-radius)",
                      marginLeft: 4,
                    }}
                  >
                    {label}
                  </span>
                </>
              )}
            </div>
            {result?.summary && !loading && (
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: "8px 0 0" }}>
                {result.summary}
              </p>
            )}
          </div>

          {/* CTA */}
          {!isMobile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, alignItems: "flex-end" }}>
              <ScoutPrimaryBtn
                onClick={() => setProOpen(true)}
                style={{ minHeight: 42, whiteSpace: "nowrap", paddingLeft: 20, paddingRight: 20 }}
              >
                Unlock with PRO ✦
              </ScoutPrimaryBtn>
              <button
                type="button"
                onClick={() => setWhyOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.muted,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Why is this score important?
              </button>
            </div>
          )}
        </div>

        {/* Mobile CTA row */}
        {isMobile && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <ScoutPrimaryBtn onClick={() => setProOpen(true)} style={{ minHeight: 42, width: "100%" }}>
              Unlock with PRO ✦
            </ScoutPrimaryBtn>
            <button
              type="button"
              onClick={() => setWhyOpen(true)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.muted,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                textAlign: "center",
              }}
            >
              Why is this score important?
            </button>
          </div>
        )}

        {/* Score breakdown bar */}
        {result && !loading && (
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
                    <span style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.ink }}>{dim.val}<span style={{ color: color.muted, fontWeight: 400 }}>/25</span></span>
                  </div>
                  <div style={{ height: 4, borderRadius: "var(--scout-radius)", background: surface.inset, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(dim.val / 25) * 100}%`, background: scoreColor, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScoutBox>

      {/* Why modal */}
      {whyOpen && (
        <ScoutModal open={whyOpen} bruddle onClose={() => setWhyOpen(false)} ariaLabelledBy="discovery-why-title" maxWidth={520}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p id="discovery-why-title" style={{ ...bruddleHeadingStyle("h4"), margin: "0 0 4px" }}>
              Why is this score important?
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, lineHeight: 1.65, margin: 0 }}>
              Your Discovery Score is a competitive ranking — it shows how well your profile stacks up against other professionals targeting the same types of roles.
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, lineHeight: 1.65, margin: 0 }}>
              We evaluate four things: how strong your resume is, how clearly you're positioned for your target roles, how ready you are for today's job market, and how many competitive signals recruiters would pick up on.
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, lineHeight: 1.65, margin: 0 }}>
              A higher score means more visibility, better job matches, and a stronger first impression — whether you're applying directly or being surfaced to hiring managers.
            </p>
            {result?.topImprovement && (
              <div style={{ background: "rgba(26,58,47,0.06)", border: "var(--scout-border)", borderRadius: "var(--scout-radius)", padding: "14px 16px" }}>
                <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Top improvement
                </p>
                <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, lineHeight: 1.55, margin: 0 }}>
                  {result.topImprovement}
                </p>
              </div>
            )}
          </div>
        </ScoutModal>
      )}

      {/* Pro upgrade modal */}
      {proOpen && (
        <GrowthUpgradeModal trigger="low_match" onClose={() => setProOpen(false)} />
      )}
    </>
  );
}

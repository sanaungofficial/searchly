"use client";

import Link from "next/link";
import { ScoutBox, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { DiscoveryScoreCluster } from "@/components/scout/discovery-score-ui";
import { useDiscoveryScore } from "@/hooks/use-discovery-score";
import { useSubscription } from "@/hooks/useSubscription";
import { bruddleHeadingStyle, color, fontSans, fontDisplay, surface, type as T } from "@/lib/typography";
import type { DiscoveryScoreInput } from "@/lib/discovery-score";
import { tierPeerCopy } from "@/lib/discovery-score";

type Props = {
  input: DiscoveryScoreInput;
  avatarUrl: string | null;
  isMobile: boolean;
  withClientScope: (path: string) => string;
  onSubscribe?: () => void;
  isLoggedIn?: boolean;
  loginHref?: string;
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return <>{init}</>;
}

function GateShell({
  title,
  body,
  primaryLabel,
  onPrimary,
  href,
}: {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary?: () => void;
  href?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(250, 247, 240, 0.55)",
        backdropFilter: "blur(2px)",
        borderRadius: "inherit",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 300 }}>
        <p style={{ ...bruddleHeadingStyle("h6"), margin: "0 0 8px", color: color.forest }}>{title}</p>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: "0 0 14px" }}>
          {body}
        </p>
        {href ? (
          <Link href={href} style={{ textDecoration: "none" }}>
            <ScoutPrimaryBtn style={{ minHeight: 40, paddingLeft: 18, paddingRight: 18 }}>{primaryLabel}</ScoutPrimaryBtn>
          </Link>
        ) : (
          <ScoutPrimaryBtn onClick={onPrimary} style={{ minHeight: 40, paddingLeft: 18, paddingRight: 18 }}>
            {primaryLabel}
          </ScoutPrimaryBtn>
        )}
      </div>
    </div>
  );
}

export function DiscoveryScoreCard({
  input,
  avatarUrl,
  isMobile,
  withClientScope,
  onSubscribe,
  isLoggedIn = true,
  loginHref = "/login?next=/dashboard",
}: Props) {
  const { isPro, isAdmin, loading: subLoading } = useSubscription();
  const hasAccess = isPro || isAdmin;

  const { result, loading, refreshing, refresh } = useDiscoveryScore({
    input,
    withClientScope,
    hasAccess,
    isLoggedIn,
    subLoading,
    onSubscribe,
  });

  const previewScore = 68;
  const score = result?.score ?? previewScore;
  const tier = result?.tier ?? "building";
  const primaryRole = input.targetRoles[0] ?? input.headline ?? "similar roles";
  const peerCopy = tierPeerCopy(tier, primaryRole);

  const showBlur = !isLoggedIn || !hasAccess || subLoading;
  const showLoginGate = isLoggedIn === false;
  const showSubscribeGate = isLoggedIn && !subLoading && !hasAccess;

  return (
    <div style={{ position: "relative" }}>
      <ScoutBox
        padding={isMobile ? "20px 18px" : "24px 28px"}
        style={{
          background: "linear-gradient(135deg, var(--scout-surface) 0%, rgba(26,58,47,0.04) 100%)",
        }}
      >
        <div
          style={{
            filter: showBlur ? "blur(8px)" : "none",
            pointerEvents: showBlur ? "none" : "auto",
            userSelect: showBlur ? "none" : "auto",
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
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={input.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Initials name={input.name} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Discovery Score
                </p>
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={loading || refreshing || subLoading}
                    style={{
                      padding: "4px 10px",
                      background: "transparent",
                      color: color.forest,
                      border: "1.5px solid rgba(26,58,47,0.2)",
                      borderRadius: "var(--scout-radius)",
                      fontFamily: fontSans,
                      fontSize: T.label,
                      fontWeight: 600,
                      cursor: loading || refreshing || subLoading ? "not-allowed" : "pointer",
                      opacity: loading || refreshing || subLoading ? 0.65 : 1,
                    }}
                  >
                    {loading || refreshing ? "…" : "Refresh"}
                  </button>
                )}
              </div>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, margin: "0 0 4px" }}>
                {peerCopy}
              </p>
              {result?.summary && !loading && (
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: 0 }}>
                  {result.summary}
                </p>
              )}
            </div>

            {loading && hasAccess && isLoggedIn ? (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "var(--scout-radius)",
                  background: surface.inset,
                  flexShrink: 0,
                }}
                aria-hidden
              />
            ) : (
              <DiscoveryScoreCluster
                result={result}
                score={score}
                align={isMobile ? "left" : "right"}
              />
            )}
          </div>
        </div>

        {showLoginGate && (
          <GateShell
            title="Log in to see your score"
            body="Hey — you gotta log in to see your personal high score."
            primaryLabel="Log in"
            href={loginHref}
          />
        )}
        {showSubscribeGate && (
          <GateShell
            title="Subscribe to see your score"
            body="You need Kimchi Pro to see how you rank against peers in similar roles."
            primaryLabel="View Pro plans ✦"
            onPrimary={onSubscribe}
          />
        )}
      </ScoutBox>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { DiscoveryScoreCluster } from "@/components/scout/discovery-score-ui";
import { useDiscoveryScore } from "@/hooks/use-discovery-score";
import { useSubscription } from "@/hooks/useSubscription";
import { profileCompletenessPct } from "@/lib/profile-completeness";
import type { DiscoveryScoreInput, DiscoveryScoreResult } from "@/lib/discovery-score";
import { tierPeerCopy } from "@/lib/discovery-score";
import { bruddleHeadingStyle, color, fontSans, fontDisplay, surface, type as T } from "@/lib/typography";

type ProfileInput = {
  name: string;
  headline: string | null;
  targetRoles: string[];
  resumeUrl: string | null;
  linkedinUrl: string | null;
  experience: unknown[] | null;
  skills: string[] | null;
  targetSalary: string | null;
  location: string | null;
  employmentStatus: string | null;
  summary: string | null;
  jobTimeline: string | null;
  linkedInAnalysisScore: number | null;
  avatarUrl: string | null;
  email?: string | null;
  parsedData?: {
    phone?: string | null;
    location?: string | null;
    education?: unknown[];
    workExperience?: unknown[];
    skills?: unknown[];
    tools?: unknown[];
  } | null;
  priorities?: string[];
};

type Props = {
  profile: ProfileInput;
  isMobile: boolean;
  withClientScope: (path: string) => string;
  onSubscribe: () => void;
  /** When false, show login preview shell instead of Pro gate. */
  isLoggedIn?: boolean;
  loginHref?: string;
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return <>{init}</>;
}

function availabilityScore(profile: ProfileInput): number {
  let pts = 0;
  if (profile.employmentStatus?.trim()) pts += 40;
  if (profile.jobTimeline?.trim()) pts += 40;
  if (profile.targetSalary?.trim()) pts += 20;
  return pts;
}

function profileQualityScore(breakdown: DiscoveryScoreResult["breakdown"] | null): number {
  if (!breakdown) return 0;
  return Math.round(((breakdown.resumeStrength + breakdown.positioningClarity) / 50) * 100);
}

type FoundationMetric = {
  id: string;
  label: string;
  value: number | null;
  display: string;
  highImpact: boolean;
  detail: string;
};

function buildFoundationMetrics(
  profile: ProfileInput,
  result: DiscoveryScoreResult | null,
): FoundationMetric[] {
  const completion = profileCompletenessPct(profile);
  const quality = result ? profileQualityScore(result.breakdown) : null;
  const rating = profile.linkedInAnalysisScore;
  const availability = availabilityScore(profile);

  return [
    {
      id: "quality",
      label: "Profile quality",
      value: quality,
      display: quality != null ? `${quality}%` : "—",
      highImpact: quality == null || quality < 60,
      detail: "Resume strength and positioning clarity",
    },
    {
      id: "completion",
      label: "Profile completion",
      value: completion,
      display: `${completion}%`,
      highImpact: completion < 70,
      detail: "Fields filled across your Kimchi profile",
    },
    {
      id: "rating",
      label: "LinkedIn quality",
      value: rating,
      display: rating != null ? `${rating}%` : "—",
      highImpact: rating == null || rating < 60,
      detail: rating != null ? "From your LinkedIn analysis" : "Build your LinkedIn preview to score",
    },
    {
      id: "availability",
      label: "Availability",
      value: availability,
      display: `${availability}%`,
      highImpact: availability < 60,
      detail: "Timeline, status, and salary expectations",
    },
  ];
}

function LoginGateOverlay({ loginHref }: { loginHref: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(250, 247, 240, 0.55)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          background: "#1A3A2F",
          border: "1px solid rgba(232,213,163,0.25)",
          borderRadius: "var(--scout-radius)",
          padding: "36px 28px",
          boxShadow: "var(--scout-shadow-card)",
        }}
      >
        <p
          style={{
            fontFamily: fontDisplay,
            fontSize: 26,
            fontWeight: 600,
            fontStyle: "italic",
            color: "#E8D5A3",
            margin: "0 0 10px",
            lineHeight: 1.2,
          }}
        >
          Log in to see your score
        </p>
        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.body,
            color: "rgba(232,213,163,0.78)",
            lineHeight: 1.65,
            margin: "0 0 24px",
          }}
        >
          Hey — you gotta log in to see your score. Create an account to see your personal high score and how you rank against peers.
        </p>
        <Link href={loginHref} style={{ textDecoration: "none", display: "block" }}>
          <ScoutPrimaryBtn style={{ width: "100%", minHeight: 44 }}>Log in</ScoutPrimaryBtn>
        </Link>
      </div>
    </div>
  );
}

function SubscribeGateOverlay({ onSubscribe }: { onSubscribe: () => void }) {
  return (
    <div
      role="presentation"
      onClick={onSubscribe}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(250, 247, 240, 0.55)",
        backdropFilter: "blur(2px)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          background: "#1A3A2F",
          border: "1px solid rgba(232,213,163,0.25)",
          borderRadius: "var(--scout-radius)",
          padding: "36px 28px",
          boxShadow: "var(--scout-shadow-card)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          style={{
            fontFamily: fontDisplay,
            fontSize: 26,
            fontWeight: 600,
            fontStyle: "italic",
            color: "#E8D5A3",
            margin: "0 0 10px",
            lineHeight: 1.2,
          }}
        >
          Subscribe to see your score
        </p>
        <p
          style={{
            fontFamily: fontSans,
            fontSize: T.body,
            color: "rgba(232,213,163,0.78)",
            lineHeight: 1.65,
            margin: "0 0 24px",
          }}
        >
          You need Kimchi Pro to see your personal high score — how you rank against professionals targeting similar roles.
        </p>
        <ScoutPrimaryBtn onClick={onSubscribe} style={{ width: "100%", minHeight: 44 }}>
          View Pro plans ✦
        </ScoutPrimaryBtn>
      </div>
    </div>
  );
}

export function ProfileDiscoveryScorePanel({
  profile,
  isMobile,
  withClientScope,
  onSubscribe,
  isLoggedIn = true,
  loginHref = "/login?next=/profile/discovery-score",
}: Props) {
  const { isPro, isAdmin, loading: subLoading } = useSubscription();
  const hasAccess = isPro || isAdmin;

  const discoveryInput: DiscoveryScoreInput = useMemo(
    () => ({
      name: profile.name,
      headline: profile.headline,
      targetRoles: profile.targetRoles,
      resumeUrl: profile.resumeUrl,
      linkedinUrl: profile.linkedinUrl,
      experience: profile.experience,
      skills: profile.skills,
      targetSalary: profile.targetSalary,
      location: profile.location,
      employmentStatus: profile.employmentStatus,
      summary: profile.summary,
    }),
    [
      profile.name,
      profile.headline,
      profile.targetRoles,
      profile.resumeUrl,
      profile.linkedinUrl,
      profile.experience,
      profile.skills,
      profile.targetSalary,
      profile.location,
      profile.employmentStatus,
      profile.summary,
    ],
  );

  const { result, loading, refreshing, refresh, fetchedAt } = useDiscoveryScore({
    input: discoveryInput,
    withClientScope,
    hasAccess,
    isLoggedIn,
    subLoading,
    onSubscribe,
  });

  const previewScore = 72;
  const score = result?.score ?? previewScore;
  const tier = result?.tier ?? "strong";
  const primaryRole = profile.targetRoles[0] ?? profile.headline ?? "similar roles";
  const peerCopy = tierPeerCopy(tier, primaryRole);

  const foundationMetrics = buildFoundationMetrics(profile, result);
  const showBlur = !isLoggedIn || !hasAccess || subLoading;
  const showLoginOverlay = isLoggedIn === false;
  const showSubscribeOverlay = isLoggedIn && !subLoading && !hasAccess;

  return (
    <div style={{ position: "relative", paddingBottom: 40 }}>
      <div
        style={{
          filter: showBlur ? "blur(8px)" : "none",
          pointerEvents: showBlur ? "none" : "auto",
          userSelect: showBlur ? "none" : "auto",
        }}
      >
        <ScoutBox
          padding={isMobile ? "22px 18px" : "28px 32px"}
          style={{
            marginBottom: 24,
            background: "linear-gradient(135deg, var(--scout-surface) 0%, rgba(26,58,47,0.06) 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: isMobile ? "flex-start" : "center",
              gap: isMobile ? 18 : 28,
              flexDirection: isMobile ? "column" : "row",
            }}
          >
            <div
              style={{
                width: isMobile ? 80 : 96,
                height: isMobile ? 80 : 96,
                borderRadius: "50%",
                flexShrink: 0,
                border: "3px solid rgba(26,58,47,0.12)",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: surface.card,
                fontFamily: fontSans,
                fontSize: isMobile ? 22 : 26,
                fontWeight: 700,
                color: color.forest,
              }}
            >
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Initials name={profile.name} />
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 6,
                  flexWrap: "wrap",
                }}
              >
                <p
                  style={{
                    fontFamily: fontSans,
                    fontSize: T.label,
                    color: color.muted,
                    margin: 0,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  Discovery Score
                </p>
                {isLoggedIn && (
                  <ScoutSecondaryBtn
                    onClick={refresh}
                    disabled={hasAccess && (loading || refreshing || subLoading)}
                    style={{ padding: "6px 12px", fontSize: T.label }}
                  >
                    {hasAccess && (loading || refreshing) ? "Loading…" : "Refresh"}
                  </ScoutSecondaryBtn>
                )}
              </div>
              {fetchedAt && hasAccess && !loading && (
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "0 0 6px" }}>
                  Last updated {new Date(fetchedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              )}
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, margin: "0 0 6px" }}>
                {peerCopy}
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, lineHeight: 1.6, margin: 0 }}>
                {result?.summary ??
                  (hasAccess
                    ? "Complete your profile to see how you compare to others targeting similar roles."
                    : "Your competitive ranking against professionals with similar backgrounds.")}
              </p>
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
        </ScoutBox>

        <div style={{ marginBottom: 8 }}>
          <h2 style={{ ...bruddleHeadingStyle("h4"), margin: "0 0 16px" }}>Build your foundation</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
              gap: 14,
            }}
          >
            {foundationMetrics.map((metric) => (
              <ScoutBox key={metric.id} padding={isMobile ? "16px 18px" : "18px 20px"}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: 0 }}>
                    {metric.label}
                  </p>
                  {metric.highImpact && (
                    <span
                      style={{
                        fontFamily: fontSans,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#b45309",
                        background: "rgba(196,168,106,0.18)",
                        padding: "3px 8px",
                        borderRadius: "var(--scout-radius)",
                        flexShrink: 0,
                      }}
                    >
                      High impact
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 400, color: color.forest, margin: "0 0 8px", lineHeight: 1 }}>
                  {metric.display}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px", lineHeight: 1.45 }}>
                  {metric.detail}
                </p>
                {metric.value != null && (
                  <div style={{ height: 4, borderRadius: "var(--scout-radius)", background: surface.inset, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(100, metric.value)}%`,
                        background: metric.highImpact ? color.gold : color.forest,
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                )}
              </ScoutBox>
            ))}
          </div>
        </div>

        {result?.topImprovement && hasAccess && !loading && isLoggedIn && (
          <ScoutBox padding={isMobile ? "16px 18px" : "18px 22px"} style={{ marginTop: 20 }}>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 700,
                color: color.forest,
                margin: "0 0 8px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Boost your ranking
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, lineHeight: 1.6, margin: 0 }}>
              {result.topImprovement}
            </p>
          </ScoutBox>
        )}
      </div>

      {showLoginOverlay && <LoginGateOverlay loginHref={loginHref} />}
      {showSubscribeOverlay && <SubscribeGateOverlay onSubscribe={onSubscribe} />}
    </div>
  );
}

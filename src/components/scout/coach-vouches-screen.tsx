"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ScoutBox, scoutPrimaryCtaStyle } from "@/components/scout/scout-box";
import { CoachOnboardingHeader } from "./coach-onboarding-screens";
import { coachVouchShareMessage } from "@/lib/coach-onboarding";
import { bruddleHeadingStyle, color, fontSans, type as T } from "@/lib/typography";

const CARD_PADDING = "clamp(16px, 4vw, 24px)";

const PRIMARY_CTA: React.CSSProperties = {
  ...scoutPrimaryCtaStyle,
  padding: "14px 24px",
  fontFamily: fontSans,
  fontSize: T.btnMd,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 48,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const SHARE_CHANNELS = [
  "Past clients & mentees",
  "LinkedIn post",
  "Tweet",
  "Facebook post",
  "Instagram story",
  "Threads",
  "Slack communities",
  "Discord channels",
] as const;

function SubmittedModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coach-submitted-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,26,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: "100%" }}>
      <ScoutBox padding={CARD_PADDING} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#78716c" }}
        >
          ×
        </button>
        <h2 id="coach-submitted-title" style={{ ...bruddleHeadingStyle("h5"), margin: "0 0 12px" }}>
          Your profile has been submitted!
        </h2>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, lineHeight: 1.65, color: "#52493F", margin: "0 0 20px" }}>
          Time to start collecting vouches. While the Second Ladder team reviews your profile, send your unique vouch link to
          friends, past clients, and colleagues — vouches help us approve coaches faster.
        </p>
        <div style={{ textAlign: "center", fontSize: 48, marginBottom: 16 }} aria-hidden="true">
          👍
        </div>
        <button type="button" className="onboarding-cta" onClick={onClose} style={{ ...PRIMARY_CTA, width: "100%" }}>
          Get started
        </button>
      </ScoutBox>
      </div>
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CoachVouchesScreen({ showWelcome }: { showWelcome?: boolean }) {
  const [vouchUrl, setVouchUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [vouchCount, setVouchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(Boolean(showWelcome));
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const load = useCallback(() => {
    fetch("/api/coach/vouches")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setVouchUrl(data.vouchUrl ?? "");
          setDisplayName(data.displayName ?? "");
          setVouchCount(data.count ?? 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shareMessage = vouchUrl ? coachVouchShareMessage(displayName, vouchUrl) : "";

  const onCopyLink = async () => {
    if (!vouchUrl) return;
    const ok = await copyText(vouchUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const onCopyMessage = async () => {
    if (!shareMessage) return;
    const ok = await copyText(shareMessage);
    if (ok) {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="onboarding-loading bruddle" role="status">
        <div className="onboarding-loading__spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <>
      {modalOpen && <SubmittedModal onClose={() => setModalOpen(false)} />}

      <div className="bruddle" style={{ background: "var(--scout-page)", minHeight: "100vh" }}>
        <div className="onboarding-shell">
          <CoachOnboardingHeader screen={8} />
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#78716c", textAlign: "center", margin: "8px 0 0" }}>
            Step 2 of 3 · The Second Ladder team is reviewing your profile
          </p>

          <div className="onboarding-content" style={{ maxWidth: 720 }}>
            <div className="flex flex-col gap-5 onboarding-screen-gap">
              <ScoutBox padding={CARD_PADDING} className="anim-fade-up">
                <h2 style={{ ...bruddleHeadingStyle("h3"), fontStyle: "italic", margin: "0 0 12px", lineHeight: 1.05 }}>
                  You&apos;ve told us about you. Now we want to hear from your biggest champions.
                </h2>
              </ScoutBox>

              <ScoutBox padding={CARD_PADDING} bg="rgba(26,58,47,0.04)" className="anim-fade-up">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: "0 0 8px", color: "#1A1A1A" }}>
                      Gather reviews from past clients, mentees, & supporters
                    </p>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", margin: "0 0 16px", lineHeight: 1.6 }}>
                      Coaches with 10+ vouches are more likely to get approved.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input
                        readOnly
                        value={vouchUrl}
                        style={{
                          flex: 1,
                          minWidth: 200,
                          padding: "10px 12px",
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: 13,
                          border: "var(--scout-border)",
                          background: "#fff",
                        }}
                      />
                      <button type="button" className="onboarding-cta" onClick={onCopyLink} style={PRIMARY_CTA}>
                        {copiedLink ? "Copied!" : "Copy link"}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 56 }} aria-hidden="true">👍</div>
                </div>
              </ScoutBox>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                <ScoutBox padding={CARD_PADDING}>
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#78716c", margin: "0 0 8px" }}>You have been vouched for</p>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 500, margin: "0 0 12px", color: "#1A1A1A" }}>
                    {vouchCount} {vouchCount === 1 ? "time" : "times"}
                  </p>
                  {vouchUrl && (
                    <a href={vouchUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F" }}>
                      View your vouch page →
                    </a>
                  )}
                </ScoutBox>

                <ScoutBox padding={CARD_PADDING}>
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>What are vouches?</p>
                  <ul style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", lineHeight: 1.65, margin: 0, paddingLeft: 18 }}>
                    <li>Help you stand out while your profile is in review</li>
                    <li>Show the unique impact you&apos;ve had on clients</li>
                    <li>Help our team confirm you&apos;re a great fit to coach on Kimchi</li>
                    <li>Kickstart your profile with social proof</li>
                  </ul>
                </ScoutBox>
              </div>

              <ScoutBox padding={CARD_PADDING}>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>Sharing your vouch link</p>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", margin: "0 0 16px" }}>
                  Share your link in as many of these places as possible:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {SHARE_CHANNELS.map((label) => (
                    <span
                      key={label}
                      style={{
                        padding: "8px 14px",
                        border: "1.5px solid rgba(26,58,47,0.2)",
                        borderRadius: "var(--scout-radius)",
                        fontFamily: "var(--font-ui)",
                        fontSize: 13,
                        color: "#1A1A1A",
                        background: "var(--scout-inset)",
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </ScoutBox>

              <ScoutBox padding={CARD_PADDING} bg="var(--scout-inset)">
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Need help writing your post? Try this.</p>
                <pre
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                    margin: "0 0 16px",
                    color: "#52493F",
                    background: "transparent",
                  }}
                >
                  {shareMessage}
                </pre>
                <button type="button" className="onboarding-cta" onClick={onCopyMessage} style={SECONDARY_BTN}>
                  {copiedMessage ? "Copied!" : "Copy message"}
                </button>
              </ScoutBox>

              <ScoutBox
                padding={CARD_PADDING}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}
              >
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", margin: 0 }}>
                  You can access your provider portal while we review your application.
                </p>
                <a href="/clients" style={{ ...PRIMARY_CTA, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                  Go to Clients →
                </a>
              </ScoutBox>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const SECONDARY_BTN: React.CSSProperties = {
  ...PRIMARY_CTA,
  background: "#fff",
  color: color.ink,
  boxShadow: "var(--scout-shadow-bruddle)",
};

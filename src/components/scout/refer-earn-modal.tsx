"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { REFERRAL_SUPPORT_EMAIL, LINKEDIN_SHARE_PRO_DAYS, REFERRAL_BONUS_PER_FEATURE } from "@/lib/plan-config";

type ReferralStats = {
  code: string;
  link: string;
  invitesCompleted: number;
  matchCreditsEarned: number;
  tailorCreditsEarned: number;
  scoutCreditsEarned: number;
  linkedInPending: boolean;
};

type View = "hub" | "invite" | "linkedin";

type Props = {
  onClose: () => void;
};

export function ReferEarnModal({ onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<View>("hub");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [postUrl, setPostUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/referrals");
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const copyLink = async () => {
    if (!stats?.link) return;
    await navigator.clipboard.writeText(stats.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitLinkedIn = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/referrals/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setMessage(data.message);
      setPostUrl("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const overlay = {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 1100,
  };

  const modal = {
    position: "fixed" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: view === "hub" ? 640 : 720,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "min(85vh, calc(100dvh - 32px))",
    overflow: "auto",
    background: "#FFFFFF",
    borderRadius: 16,
    zIndex: 1101,
    padding: view === "hub" ? 28 : 32,
    fontFamily: "var(--font-ui), sans-serif",
  };

  const bonus = REFERRAL_BONUS_PER_FEATURE;

  if (!mounted) return null;

  return createPortal(
    <>
      <div style={overlay} onClick={onClose} aria-hidden />
      <div style={modal} role="dialog" aria-labelledby="refer-earn-title">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: view === "hub" ? 24 : 16 }}>
          {view !== "hub" ? (
            <button type="button" onClick={() => setView("hub")} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: 4 }} aria-label="Back">←</button>
          ) : (
            <span />
          )}
          <h2 id="refer-earn-title" style={{ margin: 0, fontSize: view === "hub" ? 22 : 18, fontWeight: 700, color: "#1A1A1A", flex: 1, textAlign: view === "hub" ? "center" : "left", paddingLeft: view === "hub" ? 0 : 8 }}>
            {view === "hub" && "Referrals"}
            {view === "invite" && "Invite a friend — you both get credits"}
            {view === "linkedin" && `Share on LinkedIn — ${LINKEDIN_SHARE_PRO_DAYS} days of Pro`}
          </h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", padding: 4, color: "#8A7F72" }} aria-label="Close">×</button>
        </div>

        {view === "hub" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <button
              type="button"
              onClick={() => setView("invite")}
              style={{ background: "#FDF0F3", border: "1px solid #F0DDE3", borderRadius: 14, padding: "24px 20px", cursor: "pointer", textAlign: "left" }}
            >
              <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#1A1A1A", borderBottom: "2px solid #1A1A1A", paddingBottom: 8, display: "inline-block" }}>
                Invite Friends →
              </p>
              <p style={{ margin: "12px 0 0", fontSize: 16, fontWeight: 700, color: "#1A1A1A" }}>Extra AI credits per signup</p>
              <p style={{ margin: "16px 0 0", fontSize: 40 }}>👋</p>
            </button>
            <button
              type="button"
              onClick={() => setView("linkedin")}
              style={{ background: "#E8F8FA", border: "1px solid #C8E8EE", borderRadius: 14, padding: "24px 20px", cursor: "pointer", textAlign: "left" }}
            >
              <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#1A1A1A", borderBottom: "2px solid #1A1A1A", paddingBottom: 8, display: "inline-block" }}>
                Share About Us →
              </p>
              <p style={{ margin: "12px 0 0", fontSize: 16, fontWeight: 700, color: "#1A1A1A" }}>{LINKEDIN_SHARE_PRO_DAYS} days of Pro</p>
              <p style={{ margin: "16px 0 0", fontSize: 32 }}>in ↗</p>
            </button>
          </div>
        )}

        {view === "invite" && !loading && stats && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
              {[
                { step: "1", title: "Share your link", icon: "🔗" },
                { step: "2", title: "Your friend completes sign-up & finishes onboarding", icon: "👥" },
                { step: "3", title: "You and your friend each get +5 credits", icon: "🎁" },
              ].map((s) => (
                <div key={s.step} style={{ background: "#F7F5F2", borderRadius: 12, padding: 16 }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                  <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.45 }}>{s.title}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              {[`Resume Match: +${bonus}`, `Resume Tailor: +${bonus}`, `Insider Email: +${bonus}`].map((tag) => (
                <span key={tag} style={{ fontSize: 12, fontWeight: 600, color: "#1A3A2F", background: "rgba(74,139,106,0.15)", padding: "4px 10px", borderRadius: 20 }}>{tag}</span>
              ))}
            </div>

            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>Share Your Referral Link</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              <input readOnly value={stats.link} style={{ flex: 1, padding: "10px 14px", border: "1px solid #E5DDD0", borderRadius: 8, fontSize: 14 }} />
              <button type="button" onClick={copyLink} style={{ padding: "10px 20px", background: "#4A8B6A", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Your Rewards</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { label: "Invites Completed", value: stats.invitesCompleted },
                { label: "Match Credits Earned", value: stats.matchCreditsEarned },
                { label: "Tailor Credits Earned", value: stats.tailorCreditsEarned },
                { label: "Scout Credits Earned", value: stats.scoutCreditsEarned },
              ].map((card) => (
                <div key={card.label} style={{ background: "#F7F5F2", borderRadius: 10, padding: "16px 12px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#1A1A1A" }}>{card.value}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#8A7F72", lineHeight: 1.35 }}>{card.label}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {view === "linkedin" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { icon: "in", text: "Post on LinkedIn sharing what you liked most about using Kimchi" },
                { icon: "#", text: "Tag @Kimchi and include #kimchi and #jobsearch" },
                { icon: "✉", text: `Send your post link to ${REFERRAL_SUPPORT_EMAIL} to claim your reward` },
              ].map((s, i) => (
                <div key={i} style={{ background: "#F7F5F2", borderRadius: 12, padding: 16 }}>
                  <span style={{ display: "inline-flex", width: 28, height: 28, alignItems: "center", justifyContent: "center", background: "#4A8B6A", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 700 }}>{s.icon}</span>
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "#1A1A1A", lineHeight: 1.45 }}>{s.text}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "#52493F", marginBottom: 20 }}>
              We&apos;ll activate your Pro within 48 hours. <span style={{ color: "#8A7F72" }}>One reward per account.</span>
            </p>

            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>Submit your LinkedIn post URL</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://www.linkedin.com/feed/update/..."
                style={{ flex: 1, padding: "10px 14px", border: "1px solid #E5DDD0", borderRadius: 8, fontSize: 14 }}
              />
              <button type="button" onClick={submitLinkedIn} disabled={submitting || !postUrl.trim()} style={{ padding: "10px 16px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
                Submit
              </button>
            </div>
            {error && <p style={{ color: "#C4574A", fontSize: 13 }}>{error}</p>}
            {message && <p style={{ color: "#4A8B6A", fontSize: 13 }}>{message}</p>}

            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "https://app.kimchi.so")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", textAlign: "center", marginTop: 24, padding: "14px", background: "#1A1A1A", color: "#fff", borderRadius: 100, fontWeight: 600, textDecoration: "none", fontSize: 15 }}
            >
              Share Now on LinkedIn
            </a>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}

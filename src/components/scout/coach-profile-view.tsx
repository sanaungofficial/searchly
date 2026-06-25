"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import type { CoachProfileDetail, CoachReviewItem } from "@/lib/coach-types";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  slug: string;
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
};

function DimensionBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 5) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: color.stone }}>{label}</span>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: color.ink }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 6, background: "rgba(26,58,47,0.08)", borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color.forest, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function ReviewFormModal({
  coach,
  slug,
  onClose,
  onSubmitted,
}: {
  coach: CoachProfileDetail;
  slug: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [coachedFor, setCoachedFor] = useState("");
  const [message, setMessage] = useState("");
  const [knowledge, setKnowledge] = useState(5);
  const [value, setValue] = useState(5);
  const [responsiveness, setResponsiveness] = useState(5);
  const [supportiveness, setSupportiveness] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dims = [
    { label: "Knowledge", val: knowledge, set: setKnowledge },
    { label: "Value", val: value, set: setValue },
    { label: "Responsiveness", val: responsiveness, set: setResponsiveness },
    { label: "Supportiveness", val: supportiveness, set: setSupportiveness },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/coaches/${slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachedFor, message, knowledge, value, responsiveness, supportiveness }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit review");
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(26,26,26,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 200 }}
      onClick={onClose}
    >
      <div style={{ background: "#fff", maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 28, position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, margin: "0 0 8px" }}>Review {coach.displayName}</h2>
        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 12, fontFamily: "var(--font-ui)", fontSize: 14 }}>
            What did you get coached on?
            <input value={coachedFor} onChange={(e) => setCoachedFor(e.target.value)} placeholder="e.g. Case interview prep" style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: border.line, boxSizing: "border-box" }} />
          </label>
          {dims.map((d) => (
            <label key={d.label} style={{ display: "block", marginBottom: 10, fontFamily: "var(--font-ui)", fontSize: 14 }}>
              {d.label}: {d.val}
              <input type="range" min={1} max={5} step={1} value={d.val} onChange={(e) => d.set(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4 }} />
            </label>
          ))}
          <label style={{ display: "block", marginBottom: 16, fontFamily: "var(--font-ui)", fontSize: 14 }}>
            Your review
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required minLength={20} style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: border.line, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
          <ScoutPrimaryBtn type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Submitting…" : "Submit review"}
          </ScoutPrimaryBtn>
        </form>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: CoachReviewItem }) {
  return (
    <ScoutBox padding={16} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, margin: 0 }}>{review.authorName}</p>
          {review.coachedFor && (
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--scout-muted)", margin: "2px 0 0" }}>Coached for: {review.coachedFor}</p>
          )}
        </div>
        <CoachStarRating rating={review.rating} />
      </div>
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, lineHeight: 1.65, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>{review.message}</p>
    </ScoutBox>
  );
}

export function CoachProfileView({ slug, isMobile, isPro, onSubscribe }: Props) {
  const [coach, setCoach] = useState<CoachProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coaches/${slug}`);
      if (res.ok) setCoach(await res.json());
      else setCoach(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async () => {
    if (!coach) return;
    const res = await fetch(`/api/coaches/${slug}/follow`, { method: coach.isFollowing ? "DELETE" : "POST" });
    if (res.ok) {
      const data = await res.json();
      setCoach((c) => c ? { ...c, isFollowing: data.isFollowing, followerCount: data.followerCount } : c);
    }
  };

  const bookUrl = coach?.calLink;

  if (loading) {
    return (
      <WorkspacePageShell isMobile={isMobile} label="Coaching" mobileBarTitle="Coach" title="Loading…">
        <p style={{ color: color.muted, fontFamily: fontSans }}>Loading coach profile…</p>
      </WorkspacePageShell>
    );
  }

  if (!coach) {
    return (
      <WorkspacePageShell isMobile={isMobile} label="Coaching" mobileBarTitle="Coach" title="Coach not found">
        <p style={{ color: color.muted, fontFamily: fontSans }}>
          This coach profile isn&apos;t available. <Link href="/coaching" style={{ color: color.forest }}>Browse coaches</Link>
        </p>
      </WorkspacePageShell>
    );
  }

  const aboutText = coach.aboutMe || coach.bio || "";
  const sidebar = (
    <ScoutBox padding={20} style={{ position: isMobile ? "static" : "sticky", top: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={88} />
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: "12px 0 4px" }}>{coach.displayName}</p>
        <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
        {coach.hourlyRate && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, color: color.forest, margin: "12px 0 0" }}>
            {isPro ? `$${coach.hourlyRate}/hr` : (
              <span onClick={onSubscribe} style={{ cursor: "pointer", filter: "blur(6px)" }}>${coach.hourlyRate}/hr</span>
            )}
          </p>
        )}
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--scout-muted)", marginTop: 8 }}>
          {coach.followerCount} follower{coach.followerCount !== 1 ? "s" : ""}
        </p>
      </div>

      {bookUrl && isPro ? (
        <>
          <a href={bookUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block", marginBottom: 8 }}>
            <ScoutPrimaryBtn style={{ width: "100%", minHeight: 44 }}>Schedule free intro call</ScoutPrimaryBtn>
          </a>
          <a href={bookUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block", marginBottom: 8 }}>
            <ScoutSecondaryBtn style={{ width: "100%", minHeight: 44 }}>Book a session</ScoutSecondaryBtn>
          </a>
        </>
      ) : (
        <ScoutSecondaryBtn onClick={onSubscribe} style={{ width: "100%", minHeight: 44, marginBottom: 8 }}>
          Subscribe to book
        </ScoutSecondaryBtn>
      )}

      <ScoutSecondaryBtn onClick={toggleFollow} style={{ width: "100%", minHeight: 40, marginBottom: 8 }}>
        {coach.isFollowing ? "Following ✓" : "+ Follow"}
      </ScoutSecondaryBtn>

      <button type="button" onClick={() => setShowReview(true)} style={{ width: "100%", background: "none", border: "none", fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, cursor: "pointer", textDecoration: "underline", padding: 8 }}>
        Write a review
      </button>
    </ScoutBox>
  );

  return (
    <WorkspacePageShell
      isMobile={isMobile}
      label="Coaching"
      mobileBarTitle={coach.displayName}
      title={coach.displayName}
      subtitle={
        <Link href="/coaching" style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, textDecoration: "none" }}>
          ← Back to directory
        </Link>
      }
    >
      <div style={{ display: "flex", gap: 24, flexDirection: isMobile ? "column-reverse" : "row", alignItems: "flex-start", paddingBottom: 48 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Hero */}
          <ScoutBox padding={isMobile ? 20 : 24} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              {isMobile && <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={72} />}
              <div style={{ flex: 1 }}>
                {coach.headline && (
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, color: color.ink, lineHeight: 1.35, margin: "0 0 10px" }}>
                    {coach.headline}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {coach.isProfessionalCoach && (
                    <span style={{ padding: "4px 10px", background: "rgba(26,58,47,0.08)", fontSize: 12, fontWeight: 600, color: color.forest }}>Professional coach</span>
                  )}
                  {coach.featured && (
                    <span style={{ padding: "4px 10px", background: "rgba(196,168,106,0.15)", fontSize: 12, fontWeight: 600, color: "#7A6020" }}>Featured</span>
                  )}
                  {coach.experienceLevel && (
                    <span style={{ padding: "4px 10px", background: "rgba(26,58,47,0.04)", fontSize: 12, color: color.stone }}>{coach.experienceLevel}</span>
                  )}
                </div>
                {coach.firms.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--scout-muted)", margin: "0 0 8px" }}>
                      Experience at
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {coach.firms.map((f) => (
                        <span key={f} style={{ padding: "5px 12px", border: border.line, fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, color: color.forest }}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScoutBox>

          {/* Hourly offering */}
          <ScoutBox padding={20} style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>{coach.displayName}&apos;s offering</h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, border: border.line, background: surface.inset }}>
              <div>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>1:1 Coaching — Hourly</p>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: color.muted, margin: 0 }}>Flexible sessions tailored to your goals</p>
              </div>
              {coach.hourlyRate && (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, color: color.forest, margin: 0 }}>
                  {isPro ? `$${coach.hourlyRate}/hr` : "—"}
                </p>
              )}
            </div>
          </ScoutBox>

          {/* Expertise */}
          {coach.specialties.length > 0 && (
            <ScoutBox padding={20} style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>{coach.displayName.split(" ")[0]} can help with</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {coach.specialties.map((s) => (
                  <span key={s} style={{ padding: "6px 12px", background: "rgba(26,58,47,0.06)", fontFamily: "var(--font-ui)", fontSize: 13, color: color.forest }}>{s}</span>
                ))}
              </div>
            </ScoutBox>
          )}

          {/* About */}
          {aboutText && (
            <ScoutBox padding={20} style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>About {coach.displayName.split(" ")[0]}</h3>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, lineHeight: 1.7, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>
                {aboutExpanded ? aboutText : `${aboutText.slice(0, 500)}${aboutText.length > 500 ? "…" : ""}`}
              </p>
              {aboutText.length > 500 && (
                <button type="button" onClick={() => setAboutExpanded((v) => !v)} style={{ marginTop: 10, background: "none", border: "none", color: color.forest, fontFamily: fontSans, fontSize: T.bodySm, cursor: "pointer", fontWeight: 600 }}>
                  {aboutExpanded ? "Show less" : "View more"}
                </button>
              )}
            </ScoutBox>
          )}

          {coach.whyCoach && (
            <ScoutBox padding={20} style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Why do I coach?</h3>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, lineHeight: 1.7, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>{coach.whyCoach}</p>
            </ScoutBox>
          )}

          {/* Work & education */}
          {(coach.currentRole || coach.currentCompany) && (
            <ScoutBox padding={20} style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Work experience</h3>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>{coach.currentRole}</p>
              {coach.currentCompany && <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: color.muted, margin: 0 }}>{coach.currentCompany}</p>}
            </ScoutBox>
          )}

          {coach.schools.length > 0 && (
            <ScoutBox padding={20} style={{ marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Education</h3>
              {coach.schools.map((s) => (
                <p key={s} style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: color.stone, margin: "0 0 6px" }}>{s}</p>
              ))}
            </ScoutBox>
          )}

          {/* Reviews */}
          <ScoutBox padding={20}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, margin: 0 }}>Reviews</h3>
              <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
            </div>

            {coach.aggregates && (
              <div style={{ marginBottom: 20, maxWidth: 360 }}>
                <DimensionBar label="Knowledge" value={coach.aggregates.knowledge} />
                <DimensionBar label="Value" value={coach.aggregates.value} />
                <DimensionBar label="Responsiveness" value={coach.aggregates.responsiveness} />
                <DimensionBar label="Supportiveness" value={coach.aggregates.supportiveness} />
              </div>
            )}

            {coach.reviews.length === 0 ? (
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>No reviews yet. Be the first to share your experience.</p>
            ) : (
              coach.reviews.map((r) => <ReviewCard key={r.id} review={r} />)
            )}
          </ScoutBox>
        </div>

        {!isMobile && <div style={{ width: 280, flexShrink: 0 }}>{sidebar}</div>}
      </div>

      {isMobile && <div style={{ marginTop: 16 }}>{sidebar}</div>}

      {showReview && (
        <ReviewFormModal coach={coach} slug={slug} onClose={() => setShowReview(false)} onSubmitted={load} />
      )}
    </WorkspacePageShell>
  );
}

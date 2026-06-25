"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { CoachMatchSection, MatchScoreBadge } from "@/components/scout/match-score-ui";
import { NylasSchedulerEmbed } from "@/components/scout/nylas-scheduler-embed";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { CreditsStatusBar } from "@/components/scout/credits-display";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CoachListItem, CoachProfileDetail, CoachReviewItem } from "@/lib/coach-types";
import { border, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

const DRAWER_WIDTH = "min(1180px, calc(100vw - 16px))";
const SIDEBAR_WIDTH = 340;
const line = border.line;
const lineStrong = border.lineStrong;
const cardBg = surface.card;

type Props = {
  slug: string;
  onClose: () => void;
  isPro: boolean;
  onSubscribe: () => void;
  preview?: CoachListItem | null;
  onFollowChange?: (coachId: string, following: boolean) => void;
};

function DimensionBar({ label, value }: { label: string; value: number }) {
  const pct = (value / 5) * 100;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: fontSans, fontSize: 13, color: color.stone }}>{label}</span>
        <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ height: 6, background: "rgba(26,58,47,0.08)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color.forest }} />
      </div>
    </div>
  );
}

function CoachAiToolCard({
  title,
  subtitle,
  buttonLabel,
  creditCost,
  onClick,
}: {
  title: string;
  subtitle: string;
  buttonLabel: string;
  creditCost?: number;
  onClick: () => void;
}) {
  return (
    <div style={{ background: cardBg, border: line, borderRadius: 0, padding: "18px 20px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <p style={displayTitleStyle(T.title)}>{title}</p>
        {creditCost ? (
          <span style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, color: color.muted, whiteSpace: "nowrap", flexShrink: 0 }}>
            {creditCost} credit{creditCost !== 1 ? "s" : ""}
          </span>
        ) : null}
      </div>
      <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, lineHeight: 1.5, margin: "0 0 14px" }}>{subtitle}</p>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: color.forest,
          color: color.gold,
          border: lineStrong,
          borderRadius: 0,
          fontFamily: fontSans,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {buttonLabel}
      </button>
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
    <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(26,26,26,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 300 }} onClick={onClose}>
      <div style={{ background: "#fff", maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 28, position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>×</button>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, margin: "0 0 8px" }}>Review {coach.displayName}</h2>
        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 12, fontFamily: fontSans, fontSize: 14 }}>
            What did you get coached on?
            <input value={coachedFor} onChange={(e) => setCoachedFor(e.target.value)} style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: border.line, boxSizing: "border-box" }} />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontFamily: fontSans, fontSize: 14 }}>
            Knowledge: {knowledge}
            <input type="range" min={1} max={5} step={1} value={knowledge} onChange={(e) => setKnowledge(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontFamily: fontSans, fontSize: 14 }}>
            Value: {value}
            <input type="range" min={1} max={5} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontFamily: fontSans, fontSize: 14 }}>
            Responsiveness: {responsiveness}
            <input type="range" min={1} max={5} step={1} value={responsiveness} onChange={(e) => setResponsiveness(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontFamily: fontSans, fontSize: 14 }}>
            Supportiveness: {supportiveness}
            <input type="range" min={1} max={5} step={1} value={supportiveness} onChange={(e) => setSupportiveness(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4 }} />
          </label>
          <label style={{ display: "block", marginBottom: 16, fontFamily: fontSans, fontSize: 14 }}>
            Your review
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required minLength={20} style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: border.line, boxSizing: "border-box", resize: "vertical" }} />
          </label>
          {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
          <ScoutPrimaryBtn type="submit" disabled={submitting} style={{ width: "100%" }}>{submitting ? "Submitting…" : "Submit review"}</ScoutPrimaryBtn>
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
          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: 0 }}>{review.authorName}</p>
          {review.coachedFor && <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "2px 0 0" }}>Coached for: {review.coachedFor}</p>}
        </div>
        <CoachStarRating rating={review.rating} />
      </div>
      <p style={{ fontFamily: fontSans, fontSize: 14, lineHeight: 1.65, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>{review.message}</p>
    </ScoutBox>
  );
}

export function CoachDrawer({ slug, onClose, isPro, onSubscribe, preview, onFollowChange }: Props) {
  const isMobile = useIsMobile();
  const { openCoachPrepChat } = useWorkspace();
  const [visible, setVisible] = useState(false);
  const [coach, setCoach] = useState<CoachProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [showBooking, setShowBooking] = useState(false);

  useLayoutEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

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

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const toggleFollow = async () => {
    if (!coach) return;
    const res = await fetch(`/api/coaches/${slug}/follow`, { method: coach.isFollowing ? "DELETE" : "POST" });
    if (res.ok) {
      const data = await res.json();
      setCoach((c) => (c ? { ...c, isFollowing: data.isFollowing, followerCount: data.followerCount } : c));
      onFollowChange?.(coach.id, data.isFollowing);
    }
  };

  const matchScore = preview?.matchScore ?? 0;
  const matchLabel = preview?.matchLabel ?? "";
  const matchReasons = preview?.matchReasons ?? [];
  const matchedSkills = preview?.matchedSkills ?? [];
  const displayName = coach?.displayName ?? preview?.displayName ?? "Coach";
  const aboutText = coach?.aboutMe || coach?.bio || "";
  const bookUrl = coach?.calLink;
  const nylasConfigId = coach?.nylasSchedulerConfigId;
  const canBookInApp = Boolean(isPro && nylasConfigId && coach?.hasNylasBooking);

  const openPrepChat = () => {
    if (!coach) return;
    openCoachPrepChat({
      id: coach.id,
      slug: coach.slug ?? slug,
      displayName: coach.displayName,
      headline: coach.headline,
      category: coach.category,
      specialties: coach.specialties,
      firms: coach.firms,
      schools: coach.schools,
      aboutMe: coach.aboutMe,
      bio: coach.bio,
      whyCoach: coach.whyCoach,
      matchScore: matchScore > 0 ? matchScore : undefined,
      matchLabel: matchLabel || undefined,
      matchReasons: matchReasons.length ? matchReasons : undefined,
    });
  };

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 60 }} />
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.page,
          overflow: "hidden",
          zIndex: 70,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: isMobile ? "12px 16px" : "14px 28px", background: cardBg, borderBottom: line, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button type="button" onClick={close} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: color.mutedLight, padding: 0, lineHeight: 1 }}>×</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...displayTitleStyle(18), margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
            {coach?.headline && <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{coach.headline}</p>}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0, overflow: isMobile ? "auto" : "hidden" }}>
          <div style={{ flex: isMobile ? "none" : 1, minWidth: 0, overflowY: isMobile ? "visible" : "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
            {loading && !coach ? (
              <p style={{ padding: 24, fontFamily: fontSans, color: color.muted }}>Loading coach…</p>
            ) : !coach ? (
              <p style={{ padding: 24, fontFamily: fontSans, color: color.muted }}>Coach not found.</p>
            ) : (
              <>
                <div style={{ padding: isMobile ? "20px 16px 18px" : "28px 32px 24px", background: cardBg, borderBottom: line }}>
                  <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 24, alignItems: isMobile ? "stretch" : "flex-start" }}>
                    <div style={{ display: "flex", gap: 14, flex: 1, minWidth: 0 }}>
                      <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={isMobile ? 56 : 72} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={displayTitleStyle(isMobile ? 22 : 26, { margin: "0 0 10px", lineHeight: 1.2 })}>{coach.displayName}</h2>
                        {coach.headline && (
                          <p style={{ fontFamily: fontSans, fontSize: 15, color: color.stone, lineHeight: 1.45, margin: "0 0 12px" }}>{coach.headline}</p>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {coach.featured && <Badge label="Featured" tone="gold" />}
                          {coach.isProfessionalCoach && <Badge label="Pro coach" tone="forest" />}
                          {coach.firms.slice(0, 3).map((f) => (
                            <span key={f} style={{ padding: "4px 10px", border: line, fontFamily: fontSans, fontSize: 12, fontWeight: 500, color: color.forest }}>{f}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {matchScore > 0 && <MatchScoreBadge score={matchScore} label={matchLabel} />}
                  </div>
                </div>

                <div style={{ padding: isMobile ? "20px 16px 28px" : "28px 32px 36px" }}>
                  {matchScore > 0 && (
                    <CoachMatchSection
                      job={{ matchScore, matchLabel, matchReasons, matchedSkills }}
                    />
                  )}

                  {isMobile && (
                    <CoachAiToolCard
                      creditCost={1}
                      title="Prepare for your session"
                      subtitle="Get questions to ask, session goals, and background on this coach before you meet."
                      buttonLabel="Prep with Scout"
                      onClick={openPrepChat}
                    />
                  )}

                <ScoutBox padding={20} style={{ marginBottom: 16 }}>
                  <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Hourly coaching</h3>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, border: border.line, background: surface.inset }}>
                    <div>
                      <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>1:1 Coaching — Hourly</p>
                      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>Flexible sessions tailored to your goals</p>
                    </div>
                    {coach.hourlyRate && (
                      <p style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 600, color: color.forest, margin: 0 }}>
                        {isPro ? `$${coach.hourlyRate}/hr` : "—"}
                      </p>
                    )}
                  </div>
                  {showBooking && canBookInApp && nylasConfigId && (
                    <div style={{ marginTop: 16, border: border.line, padding: 12, background: "#fff" }}>
                      <NylasSchedulerEmbed configurationId={nylasConfigId} minHeight={480} />
                    </div>
                  )}
                </ScoutBox>

                {coach.specialties.length > 0 && (
                  <ScoutBox padding={20} style={{ marginBottom: 16 }}>
                    <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Can help with</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {coach.specialties.map((s) => (
                        <span key={s} style={{ padding: "6px 12px", background: "rgba(26,58,47,0.06)", fontFamily: fontSans, fontSize: 13, color: color.forest }}>{s}</span>
                      ))}
                    </div>
                  </ScoutBox>
                )}

                {aboutText && (
                  <ScoutBox padding={20} style={{ marginBottom: 16 }}>
                    <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>About</h3>
                    <p style={{ fontFamily: fontSans, fontSize: 14, lineHeight: 1.7, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>
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
                    <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Why I coach</h3>
                    <p style={{ fontFamily: fontSans, fontSize: 14, lineHeight: 1.7, color: color.stone, margin: 0, whiteSpace: "pre-wrap" }}>{coach.whyCoach}</p>
                  </ScoutBox>
                )}

                <ScoutBox padding={20}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: 0 }}>Reviews</h3>
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
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>No reviews yet.</p>
                  ) : (
                    coach.reviews.map((r) => <ReviewCard key={r.id} review={r} />)
                  )}
                </ScoutBox>
                </div>
              </>
            )}
          </div>

          {!loading && coach && (
            <aside
              style={{
                width: isMobile ? "100%" : SIDEBAR_WIDTH,
                flexShrink: 0,
                overflowY: isMobile ? "visible" : "auto",
                borderLeft: isMobile ? "none" : line,
                borderTop: isMobile ? line : "none",
                background: isMobile ? surface.inset : cardBg,
                padding: isMobile ? 16 : "24px 20px 32px",
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              <ScoutBox padding={20} style={{ marginBottom: isMobile ? 16 : 24 }}>
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={80} />
                    <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
                    {coach.hourlyRate && (
                      <p style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 600, color: color.forest, margin: "12px 0 0" }}>
                        {isPro ? `$${coach.hourlyRate}/hr` : (
                          <span onClick={onSubscribe} style={{ cursor: "pointer", filter: "blur(6px)" }}>${coach.hourlyRate}/hr</span>
                        )}
                      </p>
                    )}
                  </div>
                  {canBookInApp ? (
                    <>
                      <ScoutPrimaryBtn
                        onClick={() => setShowBooking((v) => !v)}
                        style={{ width: "100%", minHeight: 44, marginBottom: 8 }}
                      >
                        {showBooking ? "Hide calendar" : "Book a session"}
                      </ScoutPrimaryBtn>
                      {bookUrl && (
                        <a href={bookUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block", marginBottom: 8 }}>
                          <ScoutSecondaryBtn style={{ width: "100%", minHeight: 44 }}>External booking link</ScoutSecondaryBtn>
                        </a>
                      )}
                    </>
                  ) : bookUrl && isPro ? (
                    <>
                      <a href={bookUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block", marginBottom: 8 }}>
                        <ScoutPrimaryBtn style={{ width: "100%", minHeight: 44 }}>Schedule free intro call</ScoutPrimaryBtn>
                      </a>
                      <a href={bookUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block", marginBottom: 8 }}>
                        <ScoutSecondaryBtn style={{ width: "100%", minHeight: 44 }}>Book a session</ScoutSecondaryBtn>
                      </a>
                    </>
                  ) : (
                    <ScoutSecondaryBtn onClick={onSubscribe} style={{ width: "100%", minHeight: 44, marginBottom: 8 }}>Subscribe to book</ScoutSecondaryBtn>
                  )}
                  <ScoutSecondaryBtn onClick={toggleFollow} style={{ width: "100%", minHeight: 40, marginBottom: 8 }}>
                    {coach.isFollowing ? "Following ✓" : "+ Follow"}
                  </ScoutSecondaryBtn>
                  <button type="button" onClick={() => setShowReview(true)} style={{ width: "100%", background: "none", border: "none", fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, cursor: "pointer", textDecoration: "underline", padding: 8 }}>
                    Write a review
                  </button>
                </ScoutBox>

              {!isMobile && (
                <div>
                  <p style={displayTitleStyle(15, { margin: "0 0 14px", lineHeight: 1.3 })}>Before your session</p>
                  <CreditsStatusBar />
                  <CoachAiToolCard
                    creditCost={1}
                    title="Prepare for your session"
                    subtitle="Questions to ask, what to share about your goals, and how this coach's background fits you."
                    buttonLabel="Prep with Scout"
                    onClick={openPrepChat}
                  />
                </div>
              )}
            </aside>
          )}
        </div>
      </div>

      {showReview && coach && (
        <ReviewFormModal coach={coach} slug={slug} onClose={() => setShowReview(false)} onSubmitted={load} />
      )}
    </>
  );
}

function Badge({ label, tone }: { label: string; tone: "gold" | "forest" }) {
  const styles =
    tone === "gold"
      ? { background: "rgba(196,168,106,0.15)", color: "#7A6020" }
      : { background: "rgba(26,58,47,0.08)", color: color.forest };
  return (
    <span style={{ padding: "4px 10px", fontSize: 12, fontWeight: 600, fontFamily: fontSans, ...styles }}>{label}</span>
  );
}

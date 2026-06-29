"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { CoachProfileView } from "@/components/scout/coach-profile-view";
import {
  CoachBookingModal,
  type CoachBookingSessionType,
} from "@/components/scout/coach-booking-modal";
import { ScoutPrimaryBtn, scoutFieldStyle } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRequireAuthRedirect } from "@/hooks/use-auth-return-path";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CoachListItem, CoachProfileDetail } from "@/lib/coach-types";
import { bruddleHeadingStyle, color, fontSans, radius, surface, type as T } from "@/lib/typography";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";

const DRAWER_WIDTH = "min(1180px, calc(100vw - 16px))";
const line = "var(--scout-border)";
const cardBg = surface.card;

type Props = {
  slug: string;
  onClose: () => void;
  isPro: boolean;
  onSubscribe: () => void;
  preview?: CoachListItem | null;
  onFollowChange?: (coachId: string, following: boolean) => void;
  onMyCoachChange?: (coachId: string, isMyCoach: boolean, coachIds: string[]) => void;
};

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

  async function submit(e: FormEvent) {
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,26,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 300,
      }}
      onClick={onClose}
    >
      <div
        className="bruddle"
        style={{
          background: surface.card,
          border: line,
          borderRadius: radius.px,
          boxShadow: "4px 4px 0 #161616",
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: color.mutedLight }}
        >
          ×
        </button>
        <h2 style={{ ...bruddleHeadingStyle("h5"), margin: "0 0 16px" }}>Review {coach.displayName}</h2>
        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 12, fontFamily: fontSans, fontSize: T.bodySm }}>
            What did you get coached on?
            <input
              value={coachedFor}
              onChange={(e) => setCoachedFor(e.target.value)}
              style={{ ...scoutFieldStyle, display: "block", marginTop: 6 }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontFamily: fontSans, fontSize: T.bodySm }}>
            Knowledge: {knowledge}
            <input type="range" min={1} max={5} step={1} value={knowledge} onChange={(e) => setKnowledge(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4, accentColor: color.forest }} />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontFamily: fontSans, fontSize: T.bodySm }}>
            Value: {value}
            <input type="range" min={1} max={5} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4, accentColor: color.forest }} />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontFamily: fontSans, fontSize: T.bodySm }}>
            Responsiveness: {responsiveness}
            <input type="range" min={1} max={5} step={1} value={responsiveness} onChange={(e) => setResponsiveness(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4, accentColor: color.forest }} />
          </label>
          <label style={{ display: "block", marginBottom: 10, fontFamily: fontSans, fontSize: T.bodySm }}>
            Supportiveness: {supportiveness}
            <input type="range" min={1} max={5} step={1} value={supportiveness} onChange={(e) => setSupportiveness(Number(e.target.value))} style={{ display: "block", width: "100%", marginTop: 4, accentColor: color.forest }} />
          </label>
          <label style={{ display: "block", marginBottom: 16, fontFamily: fontSans, fontSize: T.bodySm }}>
            Your review
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
              minLength={20}
              style={{ ...scoutFieldStyle, display: "block", marginTop: 6, resize: "vertical" }}
            />
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

export function CoachDrawer({ slug, onClose, isPro, onSubscribe, preview, onFollowChange, onMyCoachChange }: Props) {
  const isMobile = useIsMobile();
  const requireAuth = useRequireAuthRedirect();
  const { openCoachPrepChat, user, authChecked, userRole, isImpersonating } = useWorkspace();
  const isAdmin = userRole === "ADMIN";
  const canSelfAssignCoach = userRole === "USER" || isImpersonating || isAdmin;
  const [visible, setVisible] = useState(false);
  const [coach, setCoach] = useState<CoachProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingModalType, setBookingModalType] = useState<CoachBookingSessionType>("intro");
  const [nextSlotStart, setNextSlotStart] = useState<number | null>(null);
  const [nextSlotLoading, setNextSlotLoading] = useState(false);

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

  const sessionDurationMinutes = coach?.schedulerDurationMinutes ?? 60;
  const canBookInApp = Boolean(coach?.hasNylasBooking);

  useEffect(() => {
    if (!coach?.hasNylasBooking || !slug) return;
    let cancelled = false;
    setNextSlotLoading(true);
    fetch(`/api/coaches/${encodeURIComponent(slug)}/availability?nextOnly=true&durationMinutes=30`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setNextSlotStart(d.nextSlot?.startTime ?? null);
      })
      .catch(() => {
        if (!cancelled) setNextSlotStart(null);
      })
      .finally(() => {
        if (!cancelled) setNextSlotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coach?.hasNylasBooking, slug]);

  const openBooking = (type: CoachBookingSessionType) => {
    if (!authChecked || !user) {
      requireAuth("login");
      return;
    }
    if (!isPro && type === "session") {
      onSubscribe();
      return;
    }
    setBookingModalType(type);
    setBookingModalOpen(true);
  };

  async function buyPackage(packageId: string) {
    if (!authChecked || !user) {
      requireAuth("login");
      return;
    }
    if (!coach) return;
    const r = await fetch("/api/coaching/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId, coachProfileId: coach.id, leadSource: "MARKETPLACE" }),
    });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error ?? "Could not start checkout");
      return;
    }
    if (d.url) window.location.href = d.url;
  }

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const closeFromBackdrop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  };

  const toggleFollow = async () => {
    if (!coach) return;
    if (!authChecked || !user) {
      requireAuth("login");
      return;
    }
    const res = await fetch(`/api/coaches/${slug}/follow`, { method: coach.isFollowing ? "DELETE" : "POST" });
    if (res.ok) {
      const data = await res.json();
      setCoach((c) => (c ? { ...c, isFollowing: data.isFollowing, followerCount: data.followerCount } : c));
      onFollowChange?.(coach.id, data.isFollowing);
    }
  };

  const toggleMyCoach = async () => {
    if (!coach) return;
    if (!authChecked || !user) {
      requireAuth("login");
      return;
    }
    const isAssigned = coach.isMyCoach ?? false;
    if (!isAssigned && coach.isInternal && !isAdmin) return;
    if (!isAssigned && coach.requiresAssignment && !isAdmin) return;
    const res = isAssigned
      ? await fetch(`/api/coaching/coach-assignment?coachProfileId=${encodeURIComponent(coach.id)}`, { method: "DELETE" })
      : await fetch("/api/coaching/coach-assignment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coachProfileId: coach.id }),
        });
    if (res.ok) {
      const data = await res.json();
      const coachIds = (data.coachIds as string[]) ?? [];
      const nextAssigned = coachIds.includes(coach.id);
      setCoach((c) => (c ? { ...c, isMyCoach: nextAssigned } : c));
      onMyCoachChange?.(coach.id, nextAssigned, coachIds);
    }
  };

  const matchScore = preview?.matchScore ?? 0;
  const matchLabel = preview?.matchLabel ?? "";
  const matchReasons = preview?.matchReasons ?? [];
  const matchedSkills = preview?.matchedSkills ?? [];
  const displayName = coach?.displayName ?? preview?.displayName ?? "Coach";

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
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={closeFromBackdrop}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: DRAWER_BACKDROP_Z }}
      />
      <div
        className="bruddle"
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.card,
          border: isMobile ? "none" : line,
          overflow: "hidden",
          zIndex: DRAWER_Z,
          boxShadow: isMobile ? "none" : "-4px 4px 0 #161616",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: isMobile ? "12px 16px" : "14px 28px",
            background: cardBg,
            borderBottom: line,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: color.mutedLight, padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...bruddleHeadingStyle("h6"), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "2px 0 0" }}>Coach profile</p>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          {loading && !coach ? (
            <p style={{ padding: 24, fontFamily: fontSans, color: color.muted }}>Loading coach…</p>
          ) : !coach ? (
            <p style={{ padding: 24, fontFamily: fontSans, color: color.muted }}>Coach not found.</p>
          ) : (
            <CoachProfileView
              coach={coach}
              isMobile={isMobile}
              matchScore={matchScore}
              matchLabel={matchLabel}
              matchReasons={matchReasons}
              matchedSkills={matchedSkills}
              sessionDurationMinutes={sessionDurationMinutes}
              canBookInApp={canBookInApp}
              bookUrl={coach.calLink}
              nextSlotStart={nextSlotStart}
              nextSlotLoading={nextSlotLoading}
              canSelfAssignCoach={canSelfAssignCoach}
              isAdmin={isAdmin}
              onBookIntro={() => openBooking("intro")}
              onBookSession={() => openBooking("session")}
              onBuyPackage={buyPackage}
              onToggleFollow={toggleFollow}
              onToggleMyCoach={toggleMyCoach}
              onWriteReview={() => setShowReview(true)}
              onPrepChat={openPrepChat}
            />
          )}
        </div>
      </div>

      {showReview && coach && (
        <ReviewFormModal coach={coach} slug={slug} onClose={() => setShowReview(false)} onSubmitted={load} />
      )}

      {coach && (
        <CoachBookingModal
          open={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          slug={slug}
          coachDisplayName={coach.displayName}
          coachPhotoUrl={coach.photoUrl}
          hourlyRate={coach.hourlyRate}
          sessionDurationMinutes={sessionDurationMinutes}
          initialSessionType={bookingModalType}
          guestName={user?.name ?? undefined}
          onBooked={load}
        />
      )}
    </>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { CoachProfileView } from "@/components/scout/coach-profile-view";
import {
  CoachBookingModal,
  type CoachBookingSessionType,
} from "@/components/scout/coach-booking-modal";
import { ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CoachProfileDetail } from "@/lib/coach-types";
import { bruddleHeadingStyle, color, displayTitleStyle, fontSans, surface, type as T } from "@/lib/typography";

const line = "var(--scout-border)";
const cardBg = surface.card;

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
        style={{
          background: "#fff",
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          border: line,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={displayTitleStyle(20, { margin: "0 0 16px" })}>Review {coach.displayName}</h2>
        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 10, fontFamily: fontSans, fontSize: 14 }}>
            What did you get coached for?
            <input
              value={coachedFor}
              onChange={(e) => setCoachedFor(e.target.value)}
              style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: line, boxSizing: "border-box" }}
            />
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
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
              minLength={20}
              style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: line, boxSizing: "border-box", resize: "vertical" }}
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

export function CoachProfilePageClient({ slug }: { slug: string }) {
  const isMobile = useIsMobile();
  const { openCoachPrepChat, user, authChecked, userRole, isImpersonating } = useWorkspace();
  const isAdmin = userRole === "ADMIN";
  const canSelfAssignCoach = userRole === "USER" || isImpersonating || isAdmin;
  const [coach, setCoach] = useState<CoachProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingModalType, setBookingModalType] = useState<CoachBookingSessionType>("intro");
  const [nextSlotStart, setNextSlotStart] = useState<number | null>(null);
  const [nextSlotLoading, setNextSlotLoading] = useState(false);

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
      window.location.href = "/login";
      return;
    }
    setBookingModalType(type);
    setBookingModalOpen(true);
  };

  async function buyPackage(packageId: string) {
    if (!authChecked || !user) {
      window.location.href = "/login";
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

  const toggleFollow = async () => {
    if (!coach) return;
    const res = await fetch(`/api/coaches/${slug}/follow`, { method: coach.isFollowing ? "DELETE" : "POST" });
    if (res.ok) {
      const data = await res.json();
      setCoach((c) => (c ? { ...c, isFollowing: data.isFollowing, followerCount: data.followerCount } : c));
    }
  };

  const toggleMyCoach = async () => {
    if (!coach) return;
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
    }
  };

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
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: fontSans, fontSize: 14, color: color.muted }}>
        Loading coach profile…
      </div>
    );
  }

  if (!coach) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ fontFamily: fontSans, fontSize: 16, color: color.stone, margin: "0 0 16px" }}>Coach not found.</p>
        <Link href="/coaching" style={{ fontFamily: fontSans, fontSize: 14, color: color.forest, fontWeight: 600 }}>
          Browse coaches
        </Link>
      </div>
    );
  }

  return (
    <div className="bruddle" style={{ minHeight: "100%", background: cardBg }}>
      <div
        style={{
          padding: isMobile ? "12px 16px" : "16px 32px",
          borderBottom: line,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/coaching"
          style={{
            fontFamily: fontSans,
            fontSize: T.bodySm,
            color: color.forest,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Back to coaching
        </Link>
      </div>

      <CoachProfileView
        coach={coach}
        isMobile={isMobile}
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

      {showReview && (
        <ReviewFormModal
          coach={coach}
          slug={slug}
          onClose={() => setShowReview(false)}
          onSubmitted={load}
        />
      )}

      {bookingModalOpen && coach && (
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
    </div>
  );
}

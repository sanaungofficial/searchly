"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type CoachPublic = {
  displayName: string;
  photoUrl: string | null;
  category: string | null;
  headline: string | null;
  bio: string | null;
  status: string;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  linkedinUrl: string | null;
  specialties: string[];
  industries: string[];
  firms: string[];
  schools: string[];
  vouchCount: number;
};

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  fontFamily: "var(--font-ui)",
  fontSize: 15,
  border: "1.5px solid rgba(26,58,47,0.2)",
  background: "#F7F5F2",
  boxSizing: "border-box",
};

function VouchFormModal({
  coach,
  coachProfileId,
  onClose,
  onSubmitted,
}: {
  coach: CoachPublic;
  coachProfileId: string;
  onClose: () => void;
  onSubmitted: (count: number) => void;
}) {
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/vouch/${coachProfileId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, authorEmail, relationship, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit vouch");
      onSubmitted(data.vouchCount ?? coach.vouchCount + 1);
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
      aria-labelledby="vouch-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,26,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(26,58,47,0.14)",
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "clamp(20px, 4vw, 28px)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#78716c" }}
        >
          ×
        </button>
        <h2 id="vouch-modal-title" style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, margin: "0 0 8px" }}>
          Vouch for {coach.displayName}
        </h2>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#52493F", lineHeight: 1.6, margin: "0 0 20px" }}>
          Share a few sentences about your experience. This helps Kimchi verify great coaches.
        </p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ fontFamily: "var(--font-ui)", fontSize: 14 }}>
            Your name *
            <input ref={firstFieldRef} required value={authorName} onChange={(e) => setAuthorName(e.target.value)} style={fieldStyle} />
          </label>
          <label style={{ fontFamily: "var(--font-ui)", fontSize: 14 }}>
            Email (optional)
            <input type="email" value={authorEmail} onChange={(e) => setAuthorEmail(e.target.value)} style={fieldStyle} />
          </label>
          <label style={{ fontFamily: "var(--font-ui)", fontSize: 14 }}>
            How do you know them? (optional)
            <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. Former coaching client" style={fieldStyle} />
          </label>
          <label style={{ fontFamily: "var(--font-ui)", fontSize: 14 }}>
            Your vouch *
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="What was it like working with them? What results did you see?"
              style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </label>
          {error && <p style={{ fontSize: 14, color: "#dc2626", margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "14px 24px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: 500,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "Submitting…" : "Submit vouch"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProfileCard({
  coach,
  firstName,
  onVouch,
}: {
  coach: CoachPublic;
  firstName: string;
  onVouch: () => void;
}) {
  const isPending = coach.status === "PENDING";

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(26,58,47,0.12)",
        padding: 24,
        position: "sticky",
        top: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 20 }}>
        {coach.photoUrl ? (
          <img src={coach.photoUrl} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", marginBottom: 14 }} />
        ) : (
          <div style={{ width: 96, height: 96, borderRadius: "50%", background: "#F7F5F2", marginBottom: 14 }} />
        )}
        <p style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 18, margin: "0 0 6px", color: "#1A1A1A" }}>{coach.displayName}</p>
        {coach.headline && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#78716c", margin: "0 0 10px", lineHeight: 1.5 }}>{coach.headline}</p>
        )}
        {isPending && (
          <span style={{ fontSize: 12, fontFamily: "var(--font-ui)", fontWeight: 600, color: "#b45309", background: "rgba(180,83,9,0.1)", padding: "4px 10px", borderRadius: 999 }}>
            Pending expert
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onVouch}
        style={{
          width: "100%",
          padding: "14px 20px",
          background: "#E8D5A3",
          color: "#1A3A2F",
          border: "none",
          fontFamily: "var(--font-ui)",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        Vouch for {firstName}
      </button>
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#78716c", lineHeight: 1.55, margin: "0 0 20px", textAlign: "center" }}>
        Vouching helps us verify that {firstName} would be a great coach on Kimchi.
      </p>

      <div style={{ borderTop: "1px solid rgba(26,58,47,0.08)", paddingTop: 16 }}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#78716c", margin: "0 0 4px" }}>Vouches for {firstName}</p>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, margin: 0, color: "#1A1A1A" }}>{coach.vouchCount}</p>
      </div>
    </div>
  );
}

export default function PublicVouchPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const coachProfileId = params.coachProfileId as string;
  const [coach, setCoach] = useState<CoachPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/vouch/${coachProfileId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Coach not found");
        return r.json();
      })
      .then((data) => {
        setCoach(data);
        if (searchParams.get("vouch") === "1") setModalOpen(true);
      })
      .catch(() => setError("This vouch link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [coachProfileId, searchParams]);

  if (loading) {
    return (
      <div className="onboarding-loading">
        <div className="onboarding-loading__spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  if (error || !coach) {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F5F2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontFamily: "var(--font-ui)", color: "#78716c" }}>{error ?? "Coach not found"}</p>
      </div>
    );
  }

  const firstName = coach.displayName.split(" ")[0] ?? coach.displayName;
  const categoryLabel = coach.category ?? "coaching";

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F5F2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 440, background: "#fff", border: "1px solid rgba(26,58,47,0.14)", padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: "0 0 16px" }}>✓</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, margin: "0 0 12px" }}>Thank you!</h1>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, color: "#52493F", lineHeight: 1.65, margin: 0 }}>
            Your vouch for {coach.displayName} has been submitted. It helps them get approved to coach on Kimchi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F2", paddingBottom: 80 }}>
      <header style={{ background: "#fff", borderBottom: "1px solid rgba(26,58,47,0.1)", padding: "16px clamp(20px, 5vw, 48px)" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 500, margin: 0, color: "#1A1A1A" }}>Kimchi</p>
      </header>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(24px, 5vw, 48px) clamp(20px, 5vw, 48px)" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 500, fontStyle: "italic", margin: "0 0 32px", color: "#1A1A1A", lineHeight: 1.2 }}>
          Make your voice heard. Vouching for {firstName}&apos;s expertise will help them get approved.
        </h1>

        <div className="vouch-page-grid" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 300px) 1fr", gap: 32, alignItems: "start" }}>
          <ProfileCard coach={coach} firstName={firstName} onVouch={() => setModalOpen(true)} />

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {coach.specialties.length > 0 && (
              <section style={{ background: "#fff", border: "1px solid rgba(26,58,47,0.12)", padding: "24px 28px" }}>
                <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: "#1A1A1A" }}>
                  {coach.displayName}&apos;s {categoryLabel} qualifications
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {coach.specialties.map((s) => (
                    <span key={s} style={{ padding: "6px 12px", background: "#F7F5F2", border: "1px solid rgba(26,58,47,0.12)", fontFamily: "var(--font-ui)", fontSize: 13, color: "#1A1A1A" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {coach.bio && (
              <section style={{ background: "#fff", border: "1px solid rgba(26,58,47,0.12)", padding: "24px 28px" }}>
                <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: "#1A1A1A" }}>About</h2>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, color: "#52493F", lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{coach.bio}</p>
              </section>
            )}

            {(coach.currentRole || coach.currentCompany) && (
              <section style={{ background: "#fff", border: "1px solid rgba(26,58,47,0.12)", padding: "24px 28px" }}>
                <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: "#1A1A1A" }}>Experience</h2>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 40, height: 40, background: "#F7F5F2", border: "1px solid rgba(26,58,47,0.1)", flexShrink: 0 }} />
                  <div>
                    {coach.currentRole && <p style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>{coach.currentRole}</p>}
                    {coach.currentCompany && <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#78716c", margin: 0 }}>{coach.currentCompany}</p>}
                    {coach.location && <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#78716c", margin: "4px 0 0" }}>{coach.location}</p>}
                  </div>
                </div>
              </section>
            )}

            {coach.schools.length > 0 && (
              <section style={{ background: "#fff", border: "1px solid rgba(26,58,47,0.12)", padding: "24px 28px" }}>
                <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: "#1A1A1A" }}>Education</h2>
                {coach.schools.map((school) => (
                  <div key={school} style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, background: "#F7F5F2", border: "1px solid rgba(26,58,47,0.1)", flexShrink: 0 }} />
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 500, margin: 0, alignSelf: "center" }}>{school}</p>
                  </div>
                ))}
              </section>
            )}

            {coach.linkedinUrl && (
              <a href={coach.linkedinUrl} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F" }}>
                View LinkedIn profile →
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="vouch-mobile-cta" style={{ display: "none", position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "#fff", borderTop: "1px solid rgba(26,58,47,0.12)", zIndex: 50 }}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{ width: "100%", padding: "14px 20px", background: "#E8D5A3", color: "#1A3A2F", border: "none", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          Vouch for {firstName}
        </button>
      </div>

      {modalOpen && (
        <VouchFormModal
          coach={coach}
          coachProfileId={coachProfileId}
          onClose={() => setModalOpen(false)}
          onSubmitted={(count) => {
            setCoach((c) => (c ? { ...c, vouchCount: count } : c));
            setModalOpen(false);
            setSubmitted(true);
          }}
        />
      )}

      <style jsx global>{`
        @media (max-width: 767px) {
          .vouch-page-grid {
            grid-template-columns: 1fr !important;
          }
          .vouch-mobile-cta {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}

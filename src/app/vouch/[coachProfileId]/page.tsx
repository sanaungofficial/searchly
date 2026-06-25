"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type CoachPublic = {
  displayName: string;
  photoUrl: string | null;
  category: string | null;
  headline: string | null;
};

export default function PublicVouchPage() {
  const params = useParams();
  const coachProfileId = params.coachProfileId as string;
  const [coach, setCoach] = useState<CoachPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/vouch/${coachProfileId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Coach not found");
        return r.json();
      })
      .then(setCoach)
      .catch(() => setError("This vouch link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [coachProfileId]);

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
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="onboarding-loading">
        <div className="onboarding-loading__spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  if (error && !coach) {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F5F2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ fontFamily: "var(--font-ui)", color: "#78716c" }}>{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F5F2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 440, background: "#fff", border: "1px solid rgba(26,58,47,0.14)", padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: "0 0 16px" }}>✓</p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, margin: "0 0 12px" }}>Thank you!</h1>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, color: "#52493F", lineHeight: 1.65, margin: 0 }}>
            Your vouch for {coach?.displayName} has been submitted. It helps them get approved to coach on Kimchi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F2", padding: "clamp(24px, 5vw, 48px)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 500, marginBottom: 32 }}>Kimchi</p>

        <div style={{ background: "#fff", border: "1px solid rgba(26,58,47,0.14)", padding: "clamp(20px, 4vw, 32px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            {coach?.photoUrl ? (
              <img src={coach.photoUrl} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F7F5F2" }} />
            )}
            <div>
              <p style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 16, margin: 0 }}>{coach?.displayName}</p>
              {coach?.headline && (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#78716c", margin: "4px 0 0" }}>{coach.headline}</p>
              )}
            </div>
          </div>

          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 5vw, 2rem)", fontWeight: 500, margin: "0 0 8px" }}>
            Vouch for {coach?.displayName}
          </h1>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, color: "#52493F", lineHeight: 1.65, margin: "0 0 24px" }}>
            Share a few sentences about your experience working with them. This helps Kimchi approve great coaches.
          </p>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ fontFamily: "var(--font-ui)", fontSize: 14 }}>
              Your name *
              <input required value={authorName} onChange={(e) => setAuthorName(e.target.value)} style={fieldStyle} />
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
                rows={6}
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
    </div>
  );
}

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

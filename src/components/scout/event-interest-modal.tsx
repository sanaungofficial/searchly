"use client";

import { useState } from "react";
import { ScoutModal } from "@/components/scout/scout-modal";
import { scoutFieldStyle } from "@/components/scout/scout-box";
import { fontSans, color, radius, type as T } from "@/lib/typography";

type Props = {
  onClose: () => void;
};

export function EventInterestModal({ onClose }: Props) {
  const [topics, setTopics] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (topics.trim().length < 3) {
      setError("Tell us what topics you'd like to see.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/event-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: topics.trim(), notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScoutModal
      open
      onClose={onClose}
      ariaLabelledBy="event-interest-title"
      maxWidth={480}
      panelStyle={{ maxHeight: "min(90vh, 640px)", overflowY: "auto" }}
    >
      {success ? (
        <>
          <p
            id="event-interest-title"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 600,
              fontStyle: "italic",
              color: color.ink,
              marginBottom: 12,
            }}
          >
            Thanks — we got it.
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.65, marginBottom: 24 }}>
            We&apos;ll use your feedback when planning upcoming live sessions.
          </p>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px 0",
              background: color.forest,
              color: "#E8D5A3",
              border: "none",
              borderRadius: radius.box,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back to dashboard
          </button>
        </>
      ) : (
        <>
          <p
            id="event-interest-title"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 600,
              fontStyle: "italic",
              color: color.ink,
              marginBottom: 8,
            }}
          >
            Register interest
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.65, marginBottom: 20 }}>
            What live topics would help you most right now? We read every response.
          </p>
          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.stone, marginBottom: 6 }}>
              Topics you&apos;d like to see *
            </label>
            <textarea
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              rows={3}
              placeholder="e.g. Director-level interviews, salary negotiation, pivoting into AI product…"
              style={{ ...scoutFieldStyle, resize: "vertical", minHeight: 80, marginBottom: 16 }}
            />
            <label style={{ display: "block", fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.stone, marginBottom: 6 }}>
              Anything else? (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Timing preferences, format ideas…"
              style={{ ...scoutFieldStyle, resize: "vertical", minHeight: 64, marginBottom: 16 }}
            />
            {error && (
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", marginBottom: 12 }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "12px 0",
                background: color.forest,
                color: "#E8D5A3",
                border: "none",
                borderRadius: radius.box,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
                opacity: submitting ? 0.7 : 1,
                marginBottom: 10,
              }}
            >
              {submitting ? "Sending…" : "Send feedback →"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.muted,
              }}
            >
              Cancel
            </button>
          </form>
        </>
      )}
    </ScoutModal>
  );
}

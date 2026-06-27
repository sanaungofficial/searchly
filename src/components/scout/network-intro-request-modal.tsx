"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

export function NetworkIntroRequestModal({
  jobId,
  jobTitle,
  companyLabel,
  recruiterName,
  open,
  onClose,
  onSuccess,
}: {
  jobId: string;
  jobTitle: string;
  companyLabel: string;
  recruiterName?: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { withClientScope } = useWorkspace();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!open || !jobId) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        withClientScope(`/api/network-jobs/${encodeURIComponent(jobId)}/intro-request`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: notes.trim() || undefined }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send intro request.");
        return;
      }
      setSent(true);
      onSuccess?.();
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setNotes("");
    setError(null);
    setSent(false);
    onClose();
  };

  return (
    <>
      <div
        role="presentation"
        onClick={handleClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 80 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request introduction"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(440px, calc(100vw - 32px))",
          background: surface.card,
          border: border.line,
          borderRadius: "var(--scout-radius)",
          zIndex: 81,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
          padding: "22px 24px 20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Request introduction
            </p>
            <h3 style={displayTitleStyle(T.heading, { margin: 0, lineHeight: 1.2 })}>{jobTitle}</h3>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "6px 0 0" }}>
              {companyLabel}
              {recruiterName ? ` · ${recruiterName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: color.muted }}
          >
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.6, margin: "0 0 16px" }}>
              Your request is in — our team will coordinate a warm introduction with the recruiter when there is a fit.
            </p>
            <ScoutPrimaryBtn onClick={handleClose} style={{ width: "100%" }}>
              Done
            </ScoutPrimaryBtn>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: "0 0 14px" }}>
              We will reach out on your behalf. Add any context that helps (timeline, why this role, location constraints).
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note for our team…"
              rows={4}
              maxLength={800}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                border: border.line,
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.ink,
                background: surface.inset,
                resize: "vertical",
                marginBottom: 12,
              }}
            />
            {error && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 12px" }}>{error}</p>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <ScoutSecondaryBtn onClick={handleClose} disabled={submitting}>
                Cancel
              </ScoutSecondaryBtn>
              <ScoutPrimaryBtn onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? "Sending…" : "Send request"}
              </ScoutPrimaryBtn>
            </div>
          </>
        )}
      </div>
    </>
  );
}

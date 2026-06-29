"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";

export type NetworkJobRequestModalKind = "intro" | "send-profile";

const COPY: Record<
  NetworkJobRequestModalKind,
  {
    title: string;
    ariaLabel: string;
    blurb: string;
    placeholder: string;
    submit: string;
    success: string;
    duplicate: string;
    endpoint: (jobId: string) => string;
  }
> = {
  intro: {
    title: "Request introduction",
    ariaLabel: "Request introduction",
    blurb: "We will coordinate a warm introduction with the recruiter when there is a fit. Add any context that helps.",
    placeholder: "Optional note for our team…",
    submit: "Send request",
    success: "Your request is in our queue — our team will follow up when there is a fit.",
    duplicate: "You already have a pending intro request for this role.",
    endpoint: (jobId) => `/api/network-jobs/${encodeURIComponent(jobId)}/intro-request`,
  },
  "send-profile": {
    title: "Send your profile",
    ariaLabel: "Send your profile",
    blurb: "We will email your Kimchi profile to the recruiter for this role. Add a short note if you want context included.",
    placeholder: "Optional note for the recruiter…",
    submit: "Send profile",
    success: "Your profile send is queued — our team will forward your profile to the recruiter.",
    duplicate: "You already have a pending profile send for this role.",
    endpoint: (jobId) => `/api/network-jobs/${encodeURIComponent(jobId)}/send-profile`,
  },
};

export function NetworkJobRequestModal({
  kind,
  jobId,
  jobTitle,
  companyLabel,
  recruiterName,
  open,
  onClose,
  onSuccess,
}: {
  kind: NetworkJobRequestModalKind;
  jobId: string;
  jobTitle: string;
  companyLabel: string;
  recruiterName?: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { withClientScope } = useWorkspace();
  const copy = COPY[kind];
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [wasDuplicate, setWasDuplicate] = useState(false);

  if (!open || !jobId) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(withClientScope(copy.endpoint(jobId)), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; duplicate?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Could not submit request.");
        return;
      }
      setWasDuplicate(Boolean(data.duplicate));
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
    setWasDuplicate(false);
    onClose();
  };

  return (
    <>
      <div role="presentation" onClick={handleClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: DRAWER_BACKDROP_Z }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.ariaLabel}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(440px, calc(100vw - 32px))",
          background: surface.card,
          border: "var(--scout-border)",
          borderRadius: "var(--scout-radius)",
          zIndex: DRAWER_Z,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
          padding: "22px 24px 20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div>
            <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 700, color: color.forest, margin: "0 0 6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {copy.title}
            </p>
            <h3 style={displayTitleStyle(T.heading, { margin: 0, lineHeight: 1.2 })}>{jobTitle}</h3>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "6px 0 0" }}>
              {companyLabel}
              {recruiterName ? ` · ${recruiterName}` : ""}
            </p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 4, color: color.muted }}>
            <X size={20} />
          </button>
        </div>

        {sent ? (
          <div>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.6, margin: "0 0 16px" }}>
              {wasDuplicate ? copy.duplicate : copy.success}
            </p>
            <ScoutPrimaryBtn onClick={handleClose} style={{ width: "100%" }}>
              Done
            </ScoutPrimaryBtn>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: "0 0 14px" }}>{copy.blurb}</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={copy.placeholder}
              rows={4}
              maxLength={800}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                border: "var(--scout-border)",
                borderRadius: "var(--scout-radius)",
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.ink,
                background: surface.inset,
                resize: "vertical",
                marginBottom: 12,
              }}
            />
            {error && <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 12px" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <ScoutSecondaryBtn onClick={handleClose} disabled={submitting}>
                Cancel
              </ScoutSecondaryBtn>
              <ScoutPrimaryBtn onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? "Sending…" : copy.submit}
              </ScoutPrimaryBtn>
            </div>
          </>
        )}
      </div>
    </>
  );
}

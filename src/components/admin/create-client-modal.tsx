"use client";

import { useEffect, useState } from "react";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

export function CreateClientModal({
  apiUrl,
  onClose,
  onCreated,
  title = "Add client",
  description = "Creates a client account you can manage right away. Resume, LinkedIn, and sign-in invite are all optional — add what you have now and fill in the rest later via View as client.",
  submitLabel = "Create client",
}: {
  apiUrl: string;
  onClose: () => void;
  onCreated: (data: Record<string, unknown>) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [sendInvite, setSendInvite] = useState(false);
  const [initialPassword, setInitialPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", email.trim());
      if (name.trim()) formData.set("name", name.trim());
      if (linkedinUrl.trim()) formData.set("linkedinUrl", linkedinUrl.trim());
      if (resumeFile) formData.set("resume", resumeFile);
      if (sendInvite && !initialPassword.trim()) formData.set("sendInvite", "true");
      if (initialPassword.trim()) formData.set("initialPassword", initialPassword.trim());

      const res = await fetch(apiUrl, { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(formatApiErrorMessage(data?.error ?? data, "Could not create client."));
      }
      if (!data.client && !data.assignment) {
        throw new Error("Unexpected response from server.");
      }
      onCreated(data);
      onClose();
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not create client."));
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 14,
    background: surface.card,
    border: "var(--scout-border)",
    borderRadius: "var(--scout-radius)",
    padding: "9px 12px",
    outline: "none",
    fontFamily: fontSans,
    boxSizing: "border-box",
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300 }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 301,
          padding: 16,
        }}
      >
        <div
          style={{
            background: surface.card,
            border: "var(--scout-border)",
            borderRadius: "var(--scout-radius)",
            width: "100%",
            maxWidth: 480,
            padding: 24,
            boxShadow: "var(--scout-shadow-card-strong)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ ...displayTitleStyle(22), margin: 0 }}>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", fontSize: 18, color: color.muted, cursor: "pointer" }}
            >
              ×
            </button>
          </div>

          <p style={{ fontSize: T.bodySm, color: color.stone, margin: "0 0 20px", lineHeight: 1.55 }}>
            {description}
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                Email *
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                Resume (optional — PDF, DOCX, or TXT)
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                style={{ ...fieldStyle, padding: "8px 12px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                LinkedIn profile URL (optional)
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                style={fieldStyle}
              />
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: T.bodySm,
                color: color.stone,
                lineHeight: 1.45,
                cursor: "pointer",
                opacity: initialPassword.trim() ? 0.55 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={sendInvite}
                disabled={Boolean(initialPassword.trim())}
                onChange={(e) => setSendInvite(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                Send sign-in invite email
                <span style={{ display: "block", fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                  {initialPassword.trim()
                    ? "Disabled when you set a password — they can log in with that instead."
                    : "Recommended. They'll get an email to set up their account."}
                </span>
              </span>
            </label>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                Initial password (optional)
              </label>
              <input
                type="password"
                value={initialPassword}
                onChange={(e) => {
                  setInitialPassword(e.target.value);
                  if (e.target.value.trim()) setSendInvite(false);
                }}
                autoComplete="new-password"
                placeholder="Set a password they can use to sign in"
                style={fieldStyle}
              />
              <p style={{ fontSize: T.caption, color: color.muted, margin: "6px 0 0", lineHeight: 1.45 }}>
                Creates their login immediately — no email sent. You can sign in as them on the login page with this password.
              </p>
            </div>
            <p style={{ fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.45 }}>
              Resume parse uses AI on production. LinkedIn import needs Apify configured.
            </p>
            {error && <p style={{ fontSize: T.bodySm, color: "#C4574A", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "10px 16px",
                  background: surface.inset,
                  border: "var(--scout-border)",
                  borderRadius: "var(--scout-radius)",
                  fontSize: 14,
                  fontFamily: fontSans,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "10px 18px",
                  background: color.forest,
                  color: color.gold,
                  border: "none",
                  borderRadius: "var(--scout-radius)",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: fontSans,
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Creating…" : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

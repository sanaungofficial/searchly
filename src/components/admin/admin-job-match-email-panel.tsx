"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, fontMono, fontSans, border, surface, type as T } from "@/lib/typography";

type DigestStatus = {
  adminEmail: string;
  resendConfigured: boolean;
  cronSecretConfigured: boolean;
  hirebaseConfigured: boolean;
  digestMinScore: number;
  cronSchedule: string;
  maxJobsPerEmail: number;
  liveMode: boolean;
  allowlist: string[];
  automatedSendingEnabled: boolean;
  usersWithDigestEnabled: number;
  digestsSentToday: number;
};

type PreviewResult = {
  subject: string;
  html: string;
  source: "snapshot" | "generated" | "sample";
  totalNew: number;
  jobs: Array<{ title: string; company: string; score: number; label: string; reasons?: string[] }>;
};

const VERCEL_ENV_URL =
  "https://vercel.com/second-ladder/kimchi/settings/environment-variables";

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        fontSize: T.label,
        fontFamily: fontMono,
        fontWeight: 600,
        background: ok ? "rgba(42,107,74,0.12)" : "rgba(196,87,74,0.1)",
        color: ok ? "#2A6B4A" : "#C4574A",
        border: `1px solid ${ok ? "rgba(42,107,74,0.25)" : "rgba(196,87,74,0.25)"}`,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
      {label}
    </span>
  );
}

export function AdminJobMatchEmailPanel() {
  const [status, setStatus] = useState<DigestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/digest-test");
      if (!res.ok) throw new Error("Could not load digest status");
      setStatus(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function runPreview(useSample: boolean) {
    setBusy(useSample ? "preview-sample" : "preview");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/digest-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", useSample }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data);
      setPreviewOpen(true);
      setMessage(
        useSample
          ? "Showing sample template data (3 example roles)."
          : `Preview loaded from ${data.source} data.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  }

  async function runSend(useSample: boolean) {
    const to = customTo.trim() || status?.adminEmail;
    if (!to) return;
    if (!status?.resendConfigured) {
      setError("Set RESEND_API_KEY in Vercel before sending.");
      return;
    }

    setBusy(useSample ? "send-sample" : "send");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/digest-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          useSample,
          to: customTo.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setMessage(`Sent to ${data.sentTo} (${data.source} data · ${data.jobs?.length ?? 0} roles). Check your inbox.`);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <ScoutBox padding="24px 28px">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <div>
            <ScoutLabel>Email</ScoutLabel>
            <h3 style={{ fontFamily: fontSans, fontSize: 20, fontWeight: 600, color: color.forest, margin: "6px 0 4px" }}>
              Job match digest (Resend)
            </h3>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, maxWidth: 520, lineHeight: 1.55 }}>
              Preview and send test emails before turning on automated daily sends. Up to 3 matched roles per email with score and fit reasons.
            </p>
          </div>
          <ScoutSecondaryBtn onClick={loadStatus} disabled={loading}>
            Refresh
          </ScoutSecondaryBtn>
        </div>

        {!status?.automatedSendingEnabled && (
          <div
            style={{
              marginBottom: 20,
              padding: "14px 16px",
              background: "rgba(196,168,106,0.1)",
              border: "1px solid rgba(196,168,106,0.35)",
            }}
          >
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: "#6B5A2A", margin: "0 0 6px" }}>
              Automated sends are OFF for all users
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.stone, margin: 0, lineHeight: 1.55 }}>
              The daily cron still builds job snapshots, but nobody gets emailed until you set{" "}
              <code style={{ fontFamily: fontMono }}>DIGEST_EMAIL_LIVE=true</code> or an allowlist like{" "}
              <code style={{ fontFamily: fontMono }}>DIGEST_EMAIL_ALLOWLIST=you@example.com</code> in Vercel.
            </p>
          </div>
        )}

        {loading && <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Loading…</p>}

        {status && !loading && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              <StatusPill ok={status.resendConfigured} label={status.resendConfigured ? "Resend configured" : "Resend missing"} />
              <StatusPill ok={status.hirebaseConfigured} label={status.hirebaseConfigured ? "Hirebase OK" : "Hirebase missing"} />
              <StatusPill
                ok={!status.automatedSendingEnabled}
                label={status.automatedSendingEnabled ? "Live sends ON" : "Live sends OFF (safe)"}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 12,
                marginBottom: 24,
                fontFamily: fontMono,
                fontSize: T.label,
                color: color.stone,
              }}
            >
              <div>
                <span style={{ color: color.muted }}>Cron</span>
                <div style={{ color: color.ink, marginTop: 4 }}>{status.cronSchedule}</div>
              </div>
              <div>
                <span style={{ color: color.muted }}>Roles / email</span>
                <div style={{ color: color.ink, marginTop: 4 }}>{status.maxJobsPerEmail}</div>
              </div>
              <div>
                <span style={{ color: color.muted }}>Min score</span>
                <div style={{ color: color.ink, marginTop: 4 }}>{status.digestMinScore}</div>
              </div>
              <div>
                <span style={{ color: color.muted }}>Opted in</span>
                <div style={{ color: color.ink, marginTop: 4 }}>{status.usersWithDigestEnabled} users</div>
              </div>
            </div>

            {!status.resendConfigured && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
                Add <code style={{ fontFamily: fontMono }}>RESEND_API_KEY</code> in{" "}
                <a href={VERCEL_ENV_URL} target="_blank" rel="noreferrer" style={{ color: color.forest }}>
                  Vercel env vars
                </a>
                . Verify <code style={{ fontFamily: fontMono }}>hello@kimchi.so</code> in the Resend dashboard.
              </p>
            )}

            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 10px" }}>
              1. Preview in browser (no email sent)
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
              <ScoutPrimaryBtn onClick={() => runPreview(true)} disabled={busy !== null}>
                {busy === "preview-sample" ? "Loading…" : "Preview sample template"}
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn onClick={() => runPreview(false)} disabled={busy !== null}>
                {busy === "preview" ? "Loading…" : "Preview with my matches"}
              </ScoutSecondaryBtn>
            </div>

            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 10px" }}>
              2. Send a real test email
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <input
                type="email"
                placeholder={status.adminEmail}
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  flex: "1 1 220px",
                  minWidth: 200,
                  padding: "10px 12px",
                  border: border.line,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  background: surface.card,
                }}
              />
              <ScoutPrimaryBtn onClick={() => runSend(false)} disabled={busy !== null || !status.resendConfigured}>
                {busy === "send" ? "Sending…" : "Send my matches"}
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn onClick={() => runSend(true)} disabled={busy !== null || !status.resendConfigured}>
                {busy === "send-sample" ? "Sending…" : "Send sample"}
              </ScoutSecondaryBtn>
            </div>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.5 }}>
              Defaults to your account email ({status.adminEmail}). Only admins can use this panel — nothing goes to other users.
            </p>
          </>
        )}

        {message && (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: "16px 0 0", lineHeight: 1.5 }}>
            {message}
          </p>
        )}
        {error && (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "16px 0 0", lineHeight: 1.5 }}>
            {error}
          </p>
        )}
      </ScoutBox>

      {previewOpen && preview && (
        <>
          <div
            onClick={() => setPreviewOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(26,24,20,0.55)", zIndex: 2000 }}
          />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(640px, 94vw)",
              maxHeight: "90vh",
              background: "#FFFDF9",
              border: border.lineStrong,
              zIndex: 2001,
              display: "flex",
              flexDirection: "column",
              boxShadow: "8px 8px 0 rgba(17,17,17,0.08)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: border.line,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: 0 }}>
                  Email preview
                </p>
                <p style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, margin: "4px 0 0" }}>
                  Subject: {preview.subject}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                style={{
                  padding: "8px 14px",
                  border: border.line,
                  background: "transparent",
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
            <iframe
              title="Job match digest preview"
              srcDoc={preview.html}
              style={{ flex: 1, minHeight: 480, border: "none", background: "#F2EDE3" }}
            />
          </div>
        </>
      )}
    </>
  );
}

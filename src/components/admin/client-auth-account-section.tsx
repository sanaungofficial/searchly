"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminClient } from "@/components/admin/admin-clients-panel";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  client: AdminClient;
  onUpdated: (client: AdminClient) => void;
};

export function ClientAuthAccountSection({ client, onUpdated }: Props) {
  const [emailDraft, setEmailDraft] = useState(client.email);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [hasAuthAccount, setHasAuthAccount] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setEmailDraft(client.email);
  }, [client.email]);

  const loadAuthStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/auth`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setHasAuthAccount(Boolean(data.hasAuthAccount));
    } catch {
      setHasAuthAccount(null);
    }
  }, [client.id]);

  useEffect(() => {
    void loadAuthStatus();
  }, [loadAuthStatus]);

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 14,
    background: surface.card,
    border: border.line,
    borderRadius: "var(--scout-radius)",
    padding: "9px 12px",
    outline: "none",
    fontFamily: fontSans,
    boxSizing: "border-box",
  };

  async function saveEmail() {
    const next = emailDraft.trim().toLowerCase();
    if (!next || next === client.email.toLowerCase()) return;

    setBusy("email");
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Could not update email."));
      if (data.client) onUpdated(data.client as AdminClient);
      setStatus("Email updated.");
      void loadAuthStatus();
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not update email."));
    } finally {
      setBusy(null);
    }
  }

  async function runAuthAction(action: "invite" | "password-reset" | "set-password") {
    setBusy(action);
    setError(null);
    setStatus(null);
    try {
      const body: { action: typeof action; password?: string } = { action };
      if (action === "set-password") {
        if (passwordDraft.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
        body.password = passwordDraft;
      }

      const res = await fetch(`/api/admin/clients/${client.id}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Action failed."));

      if (data.client) onUpdated(data.client as AdminClient);
      if (typeof data.hasAuthAccount === "boolean") setHasAuthAccount(data.hasAuthAccount);
      setStatus(typeof data.message === "string" ? data.message : "Done.");
      if (action === "set-password") {
        setPasswordDraft("");
        setShowPasswordField(false);
      }
    } catch (err) {
      setError(formatApiErrorMessage(err, "Action failed."));
    } finally {
      setBusy(null);
    }
  }

  const emailDirty = emailDraft.trim().toLowerCase() !== client.email.toLowerCase();

  return (
    <ScoutBox padding="16px 20px" style={{ marginBottom: 20 }}>
      <ScoutLabel>Sign-in account</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 14px", lineHeight: 1.6 }}>
        Manage how this client logs in — update their email, send an invite, reset their password, or set one for them.
      </p>

      {hasAuthAccount !== null && (
        <p
          style={{
            fontFamily: fontMono,
            fontSize: T.caption,
            color: hasAuthAccount ? color.forest : color.muted,
            margin: "0 0 14px",
          }}
        >
          {hasAuthAccount ? "Has sign-in account" : "No sign-in account yet"}
        </p>
      )}

      <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
        Email
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          type="email"
          value={emailDraft}
          onChange={(e) => setEmailDraft(e.target.value)}
          style={{ ...fieldStyle, flex: "1 1 220px" }}
        />
        <ScoutSecondaryBtn
          type="button"
          disabled={!emailDirty || busy === "email"}
          onClick={() => void saveEmail()}
          style={{ minHeight: 40, opacity: !emailDirty || busy === "email" ? 0.6 : 1 }}
        >
          {busy === "email" ? "Saving…" : "Save email"}
        </ScoutSecondaryBtn>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: showPasswordField ? 12 : 0 }}>
        <ScoutSecondaryBtn
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void runAuthAction("invite")}
          style={{ minHeight: 40 }}
        >
          {busy === "invite" ? "Sending…" : "Send invite email"}
        </ScoutSecondaryBtn>
        <ScoutSecondaryBtn
          type="button"
          disabled={Boolean(busy) || hasAuthAccount === false}
          onClick={() => void runAuthAction("password-reset")}
          style={{ minHeight: 40, opacity: hasAuthAccount === false ? 0.55 : 1 }}
        >
          {busy === "password-reset" ? "Sending…" : "Send password reset"}
        </ScoutSecondaryBtn>
        <ScoutSecondaryBtn
          type="button"
          disabled={Boolean(busy)}
          onClick={() => setShowPasswordField((v) => !v)}
          style={{ minHeight: 40 }}
        >
          {showPasswordField ? "Cancel password" : "Set password"}
        </ScoutSecondaryBtn>
      </div>

      {showPasswordField && (
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
            New password (min 8 characters)
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="password"
              value={passwordDraft}
              onChange={(e) => setPasswordDraft(e.target.value)}
              autoComplete="new-password"
              placeholder="Password for client login"
              style={{ ...fieldStyle, flex: "1 1 220px" }}
            />
            <ScoutPrimaryBtn
              type="button"
              disabled={busy === "set-password" || passwordDraft.length < 8}
              onClick={() => void runAuthAction("set-password")}
              style={{ minHeight: 40, opacity: passwordDraft.length < 8 ? 0.6 : 1 }}
            >
              {busy === "set-password" ? "Saving…" : "Save password"}
            </ScoutPrimaryBtn>
          </div>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0", lineHeight: 1.5 }}>
            Creates a sign-in account if they don&apos;t have one yet. You can use this password to log in as them on the login page.
          </p>
        </div>
      )}

      {status && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: "14px 0 0" }}>{status}</p>
      )}
      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "14px 0 0" }}>{error}</p>
      )}
    </ScoutBox>
  );
}

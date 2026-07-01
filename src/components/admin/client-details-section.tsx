"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminClient } from "@/components/admin/admin-clients-panel";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type Props = {
  client: AdminClient;
  onUpdated: (client: AdminClient) => void;
};

export function ClientDetailsSection({ client, onUpdated }: Props) {
  const [nameDraft, setNameDraft] = useState(client.name ?? "");
  const [headlineDraft, setHeadlineDraft] = useState(client.profile?.headline ?? "");
  const [linkedinDraft, setLinkedinDraft] = useState(client.profile?.linkedinUrl ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNameDraft(client.name ?? "");
    setHeadlineDraft(client.profile?.headline ?? "");
    setLinkedinDraft(client.profile?.linkedinUrl ?? "");
  }, [client.id, client.name, client.profile?.headline, client.profile?.linkedinUrl]);

  const dirty = useMemo(() => {
    const name = nameDraft.trim();
    const headline = headlineDraft.trim();
    const linkedin = linkedinDraft.trim();
    const savedName = (client.name ?? "").trim();
    const savedHeadline = (client.profile?.headline ?? "").trim();
    const savedLinkedin = (client.profile?.linkedinUrl ?? "").trim();
    return name !== savedName || headline !== savedHeadline || linkedin !== savedLinkedin;
  }, [nameDraft, headlineDraft, linkedinDraft, client.name, client.profile?.headline, client.profile?.linkedinUrl]);

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

  async function saveDetails() {
    if (!dirty) return;

    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const body: Record<string, string | null> = {
        name: nameDraft.trim() || null,
        headline: headlineDraft.trim() || null,
        linkedinUrl: linkedinDraft.trim() || null,
      };

      const res = await fetch(`/api/admin/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Could not update client."));
      if (data.client) onUpdated(data.client as AdminClient);
      setStatus("Client details saved.");
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not update client."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScoutBox padding="16px 20px" style={{ marginBottom: 20 }}>
      <ScoutLabel>Client details</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 14px", lineHeight: 1.6 }}>
        Update how this client appears in the roster and on their profile.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
            Name
          </label>
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Full name"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
            Headline
          </label>
          <input
            type="text"
            value={headlineDraft}
            onChange={(e) => setHeadlineDraft(e.target.value)}
            placeholder="e.g. Product leader · ex-Stripe"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
            LinkedIn URL
          </label>
          <input
            type="url"
            value={linkedinDraft}
            onChange={(e) => setLinkedinDraft(e.target.value)}
            placeholder="https://linkedin.com/in/…"
            style={fieldStyle}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
        <ScoutSecondaryBtn
          type="button"
          disabled={!dirty || busy}
          onClick={() => void saveDetails()}
          style={{ minHeight: 40, opacity: !dirty || busy ? 0.6 : 1 }}
        >
          {busy ? "Saving…" : "Save details"}
        </ScoutSecondaryBtn>
      </div>

      {status && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: "14px 0 0" }}>{status}</p>
      )}
      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "14px 0 0" }}>{error}</p>
      )}
    </ScoutBox>
  );
}

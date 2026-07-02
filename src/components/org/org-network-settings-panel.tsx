"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { OrgSettingsNav } from "@/components/org/org-settings-nav";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, displayTitleStyle, fontMono, fontSans, type as T } from "@/lib/typography";

type NetworkSource = {
  id: string;
  visibility: "PRIVATE" | "POOLED";
  status: "ACTIVE" | "DISCONNECTED" | "ERROR";
  email: string | null;
  provider: string | null;
  connectedAt: string | null;
};

export function OrgNetworkSettingsPanel({ orgId, isOrgAdmin = true }: { orgId: string; isOrgAdmin?: boolean }) {
  const searchParams = useSearchParams();
  const [source, setSource] = useState<NetworkSource | null>(null);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgId}/network-source`);
      const data = (await res.json()) as { source?: NetworkSource | null; configured?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load network settings.");
      setSource(data.source ?? null);
      setConfigured(Boolean(data.configured));
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load network settings."));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const network = searchParams.get("network");
    if (network === "connected") setNotice("Inbox connected for org network.");
    if (network === "error") setNotice("Inbox connect failed. Try again.");
  }, [searchParams]);

  async function connect(provider: "google" | "microsoft") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgId}/network-source/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = (await res.json()) as { authUrl?: string; linked?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not start connect.");
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      setNotice("Inbox linked to org network.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not start connect."));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgId}/network-source/disconnect`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not disconnect.");
      setNotice("Org network source disconnected.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not disconnect."));
    } finally {
      setBusy(false);
    }
  }

  const isConnected = source?.status === "ACTIVE";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      <div>
        <Link href={`/org/${orgId}/dashboard`} style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "none" }}>
          ← Org dashboard
        </Link>
        <h1 style={{ ...displayTitleStyle(28), margin: "12px 0 8px" }}>Organization settings</h1>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          Connect your Gmail or Outlook to enrich the org&apos;s shared network with email and calendar signals.
          My Network contacts are shared with your org automatically.
        </p>
        <OrgSettingsNav orgId={orgId} active="network" isOrgAdmin={isOrgAdmin} />
      </div>

      {notice && (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.forest, margin: 0 }}>{notice}</p>
      )}
      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: 0 }}>{error}</p>
      )}

      <ScoutBox padding={20}>
        <ScoutLabel>Connection</ScoutLabel>
        {loading ? (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, marginTop: 12 }}>Loading…</p>
        ) : (
          <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
            <div style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink }}>
              Status:{" "}
              <strong>{isConnected ? "Connected" : "Not connected"}</strong>
              {source?.email && (
                <span style={{ display: "block", fontFamily: fontMono, fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                  {source.email}
                </span>
              )}
            </div>

            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
              All org members share contacts from My Network for intro matching — no opt-in required.
            </p>

            {!configured && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                Inbox connect is not configured in this environment.
              </p>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ScoutPrimaryBtn disabled={busy || !configured} onClick={() => void connect("google")}>
                {busy ? "Starting…" : isConnected ? "Reconnect Gmail" : "Connect Gmail"}
              </ScoutPrimaryBtn>
              <ScoutSecondaryBtn disabled={busy || !configured} onClick={() => void connect("microsoft")}>
                {busy ? "Starting…" : isConnected ? "Reconnect Outlook" : "Connect Outlook"}
              </ScoutSecondaryBtn>
              {isConnected && (
                <ScoutSecondaryBtn disabled={busy} onClick={() => void disconnect()}>
                  Disconnect
                </ScoutSecondaryBtn>
              )}
            </div>
          </div>
        )}
      </ScoutBox>
    </div>
  );
}

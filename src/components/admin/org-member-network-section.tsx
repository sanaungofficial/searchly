"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

type NetworkSourceRow = {
  orgMemberId: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
  user: { id: string; email: string; name: string | null };
  source: {
    id: string;
    visibility: "PRIVATE" | "POOLED";
    status: "ACTIVE" | "DISCONNECTED" | "ERROR";
    email: string | null;
    provider: string | null;
    connectedAt: string | null;
    lastSyncAt: string | null;
    syncedContactCount?: number;
  } | null;
};

type NetworkSourcesResponse = {
  members?: NetworkSourceRow[];
  stats?: { total: number; contributing: number };
  error?: string;
};

const STATUS_STYLE: Record<NonNullable<NetworkSourceRow["source"]>["status"], { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: "rgba(26,58,47,0.1)", color: color.forest, label: "Connected" },
  DISCONNECTED: { bg: "rgba(160,152,144,0.12)", color: "#78716c", label: "Not connected" },
  ERROR: { bg: "rgba(196,87,74,0.12)", color: "#C4574A", label: "Error" },
};

export function OrgMemberNetworkSection({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<NetworkSourceRow[]>([]);
  const [stats, setStats] = useState({ total: 0, contributing: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingMemberId, setConnectingMemberId] = useState<string | null>(null);
  const [disconnectingMemberId, setDisconnectingMemberId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/network-sources`);
      const data = (await res.json()) as NetworkSourcesResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not load network sources.");
      setRows(data.members ?? []);
      setStats(data.stats ?? { total: 0, contributing: 0 });
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load network sources."));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function connectMember(memberId: string, provider: "google" | "microsoft") {
    setConnectingMemberId(memberId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/orgs/${orgId}/members/${memberId}/network-source/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        },
      );
      const data = (await res.json()) as { authUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not start connect.");
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not start connect."));
    } finally {
      setConnectingMemberId(null);
    }
  }

  async function disconnectMember(memberId: string) {
    setDisconnectingMemberId(memberId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/orgs/${orgId}/members/${memberId}/network-source/disconnect`,
        { method: "POST" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not disconnect.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not disconnect."));
    } finally {
      setDisconnectingMemberId(null);
    }
  }

  return (
    <ScoutBox padding={20}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <ScoutLabel>Member network sources</ScoutLabel>
        <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
          {stats.contributing} of {stats.total} in pooled network
        </span>
      </div>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 16px" }}>
        Connect member inboxes for email and calendar signals. My Network contacts are shared automatically.
      </p>

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 12px" }}>{error}</p>
      )}

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading network sources…</p>
      ) : rows.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>No members yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: T.bodySm }}>
            <thead>
              <tr style={{ textAlign: "left", color: color.muted, fontFamily: fontMono, fontSize: T.caption, textTransform: "uppercase" }}>
                <th style={{ padding: "10px 8px" }}>Member</th>
                <th style={{ padding: "10px 8px" }}>Inbox</th>
                <th style={{ padding: "10px 8px" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = row.source?.status ?? "DISCONNECTED";
                const statusStyle = STATUS_STYLE[status];
                const isConnected = status === "ACTIVE";
                const busy = connectingMemberId === row.orgMemberId || disconnectingMemberId === row.orgMemberId;

                return (
                  <tr key={row.orgMemberId} style={{ borderTop: "var(--scout-border)" }}>
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ color: color.ink, fontWeight: 600 }}>{row.user.name ?? row.user.email}</div>
                      <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>{row.user.email}</div>
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      <span
                        style={{
                          fontFamily: fontMono,
                          fontSize: T.caption,
                          padding: "2px 7px",
                          borderRadius: "var(--scout-radius)",
                          background: statusStyle.bg,
                          color: statusStyle.color,
                        }}
                      >
                        {statusStyle.label}
                      </span>
                      {row.source?.email && (
                        <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                          {row.source.email}
                        </div>
                      )}
                      {isConnected && (
                        <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                          {row.source?.syncedContactCount ?? 0} contacts synced
                          {row.source?.lastSyncAt
                            ? ` · last sync ${new Date(row.source.lastSyncAt).toLocaleDateString()}`
                            : ""}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <ScoutSecondaryBtn
                          disabled={busy}
                          onClick={() => void connectMember(row.orgMemberId, "google")}
                        >
                          {busy ? "Starting…" : isConnected ? "Reconnect Gmail" : "Connect Gmail"}
                        </ScoutSecondaryBtn>
                        <ScoutSecondaryBtn
                          disabled={busy}
                          onClick={() => void connectMember(row.orgMemberId, "microsoft")}
                        >
                          {busy ? "Starting…" : isConnected ? "Reconnect Outlook" : "Connect Outlook"}
                        </ScoutSecondaryBtn>
                        {isConnected && (
                          <ScoutSecondaryBtn
                            disabled={busy}
                            onClick={() => void disconnectMember(row.orgMemberId)}
                          >
                            {busy ? "Working…" : "Disconnect"}
                          </ScoutSecondaryBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ScoutBox>
  );
}

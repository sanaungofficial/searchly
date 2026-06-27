"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { fontSans, fontMono, color, surface, border, type as T } from "@/lib/typography";
import { formatApiErrorMessage } from "@/lib/api-error-message";

type QueueItem = {
  id: string;
  requestType: "INTRO" | "SEND_PROFILE";
  requestTypeLabel: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  statusLabel: string;
  jobTitle: string;
  companyName: string | null;
  channelCode: string | null;
  recruiterName: string | null;
  jobExternalId: string;
  jobSource: string;
  clientNotes: string | null;
  adminNotes: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: "rgba(217,119,6,0.12)", color: "#b45309" },
  IN_PROGRESS: { bg: "rgba(37,99,235,0.1)", color: "#2563eb" },
  COMPLETED: { bg: "rgba(5,150,105,0.1)", color: "#059669" },
  CANCELLED: { bg: "rgba(160,152,144,0.12)", color: "#78716c" },
};

export function AdminNetworkRequestsPanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(showAll ? { view: "done" } : { view: "open" });
      const res = await fetch(`/api/admin/network-requests?${params.toString()}`);
      const data = (await res.json()) as { requests?: QueueItem[]; pendingCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load queue.");
      setItems(data.requests ?? []);
      setPendingCount(data.pendingCount ?? 0);
      setDraftNotes((prev) => {
        const next = { ...prev };
        for (const item of data.requests ?? []) {
          if (next[item.id] === undefined) next[item.id] = item.adminNotes ?? "";
        }
        return next;
      });
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load queue."));
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (id: string, body: { status?: QueueItem["status"]; adminNotes?: string }) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/network-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Update failed."));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <ScoutBox padding={20}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <ScoutLabel>In-network request queue</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 640 }}>
            Client intro and send-profile requests from In-Network Roles. Mark complete after you have emailed the recruiter or closed the loop.
          </p>
          {!showAll && pendingCount > 0 && (
            <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.forest, margin: "8px 0 0" }}>
              {pendingCount} pending
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ScoutSecondaryBtn onClick={() => setShowAll((v) => !v)}>{showAll ? "Open queue" : "Show completed"}</ScoutSecondaryBtn>
          <ScoutSecondaryBtn onClick={() => void load()} disabled={loading}>
            Refresh
          </ScoutSecondaryBtn>
        </div>
      </div>

      {error && <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading queue…</p>
      ) : items.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          {showAll ? "No completed requests yet." : "Queue is empty — no pending intro or profile sends."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => {
            const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.PENDING;
            return (
              <div key={item.id} style={{ border: border.line, borderRadius: "var(--scout-radius)", padding: "14px 16px", background: surface.inset }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                  <div>
                    <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 700, color: color.ink, margin: "0 0 4px" }}>{item.jobTitle}</p>
                    <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
                      {item.companyName ?? "—"}
                      {item.channelCode ? ` · ${item.channelCode}` : ""}
                      {item.recruiterName ? ` · ${item.recruiterName}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontFamily: fontMono, fontSize: T.label, padding: "2px 8px", background: st.bg, color: st.color, borderRadius: 999 }}>
                      {item.statusLabel}
                    </span>
                    <span style={{ fontFamily: fontMono, fontSize: T.label, padding: "2px 8px", border: border.line, color: color.stone }}>
                      {item.requestTypeLabel}
                    </span>
                  </div>
                </div>
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px" }}>
                  {item.user.name ?? item.user.email} · {new Date(item.createdAt).toLocaleString()}
                </p>
                {item.clientNotes && (
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.ink, margin: "0 0 10px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    Client note: {item.clientNotes}
                  </p>
                )}
                <textarea
                  value={draftNotes[item.id] ?? ""}
                  onChange={(e) => setDraftNotes((d) => ({ ...d, [item.id]: e.target.value }))}
                  placeholder="Internal admin notes…"
                  rows={2}
                  style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "8px 10px", border: border.line, borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: T.caption, background: surface.card }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {item.status === "PENDING" && (
                    <ScoutSecondaryBtn disabled={savingId === item.id} onClick={() => void patch(item.id, { status: "IN_PROGRESS", adminNotes: draftNotes[item.id] })}>
                      Start
                    </ScoutSecondaryBtn>
                  )}
                  {(item.status === "PENDING" || item.status === "IN_PROGRESS") && (
                    <>
                      <ScoutPrimaryBtn disabled={savingId === item.id} onClick={() => void patch(item.id, { status: "COMPLETED", adminNotes: draftNotes[item.id] })}>
                        Complete
                      </ScoutPrimaryBtn>
                      <ScoutSecondaryBtn disabled={savingId === item.id} onClick={() => void patch(item.id, { status: "CANCELLED", adminNotes: draftNotes[item.id] })}>
                        Cancel
                      </ScoutSecondaryBtn>
                    </>
                  )}
                  <a href={`/opportunities/network/${encodeURIComponent(item.jobExternalId)}`} style={{ alignSelf: "center", fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "underline" }}>
                    View role ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ScoutBox>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn, ScoutBox } from "@/components/scout/scout-box";
import type { AssignedClientSummary } from "@/lib/coach-client-assignment";
import { color, fontMono, fontSans, surface } from "@/lib/typography";

type ClientOption = {
  id: string;
  email: string;
  name: string | null;
  headline: string | null;
};

export function CoachClientAssignmentSection({
  coachId,
  onUpdated,
}: {
  coachId: string;
  onUpdated?: () => void;
}) {
  const [assignments, setAssignments] = useState<AssignedClientSummary[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    const res = await fetch(`/api/admin/coaches/${coachId}/client-assignment`);
    if (!res.ok) throw new Error("Could not load client assignments");
    const data = await res.json();
    setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
  }, [coachId]);

  useEffect(() => {
    void loadAssignments().catch(() => setAssignments([]));
  }, [loadAssignments]);

  useEffect(() => {
    fetch("/api/admin/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setClients(
          list.map((c: ClientOption & { profile?: { headline: string | null } | null }) => ({
            id: c.id,
            email: c.email,
            name: c.name,
            headline: c.profile?.headline ?? null,
          })),
        );
      })
      .catch(() => setClients([]));
  }, []);

  const assignedIds = new Set(assignments.map((a) => a.userId));
  const available = clients.filter((c) => !assignedIds.has(c.id));

  const filteredAvailable = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return available.slice(0, 12);
    return available
      .filter(
        (c) =>
          c.email.toLowerCase().includes(q) ||
          (c.name ?? "").toLowerCase().includes(q) ||
          (c.headline ?? "").toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [available, clientSearch]);

  async function assign(id?: string) {
    const targetId = id ?? clientId;
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/client-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetId, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not assign client");
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      setClientId("");
      setClientSearch("");
      setNotes("");
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function remove(userId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/coaches/${coachId}/client-assignment?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove assignment");
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScoutBox padding={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "var(--scout-border)" }}>
        <p style={{ fontSize: 12, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, margin: 0 }}>
          Assigned clients
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.stone, margin: "6px 0 0", lineHeight: 1.45 }}>
          Job seekers working with this coach. Assignments are many-to-many — clients can have multiple coaches.
        </p>
      </div>
      <div style={{ padding: "16px 20px" }}>
        {assignments.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "0 0 16px" }}>
            No clients assigned yet. Search below to assign job seekers.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {assignments.map((a) => (
              <div
                key={a.assignmentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  border: "var(--scout-border)",
                  background: "rgba(26,58,47,0.02)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>
                    {a.name ?? a.email}
                  </p>
                  {a.name && (
                    <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>{a.email}</p>
                  )}
                  {a.notes && (
                    <p style={{ fontFamily: fontSans, fontSize: 12, color: color.stone, margin: "6px 0 0" }}>Note: {a.notes}</p>
                  )}
                </div>
                <ScoutSecondaryBtn onClick={() => remove(a.userId)} disabled={loading} style={{ minHeight: 36, fontSize: 13 }}>
                  Unassign
                </ScoutSecondaryBtn>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontFamily: fontSans, fontSize: 13, color: color.stone }}>
            Search clients to assign
            <input
              type="search"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setClientId("");
              }}
              placeholder="Name or email…"
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                border: "var(--scout-border)",
                fontFamily: fontSans,
                fontSize: 14,
                background: surface.card,
                boxSizing: "border-box",
              }}
            />
          </label>
          {clientSearch.trim() && filteredAvailable.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
              {filteredAvailable.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setClientId(c.id);
                    setClientSearch(c.name ?? c.email);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                    padding: "8px 10px",
                    border: clientId === c.id ? `2px solid ${color.forest}` : "var(--scout-border)",
                    background: clientId === c.id ? "rgba(26,58,47,0.06)" : surface.card,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink }}>
                    {c.name ?? c.email}
                  </span>
                  {c.name && (
                    <span style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>{c.email}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {clientSearch.trim() && filteredAvailable.length === 0 && (
            <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>No matching clients.</p>
          )}
          <label style={{ fontFamily: fontSans, fontSize: 13, color: color.stone }}>
            Notes (optional)
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Primary career coach"
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "10px 12px",
                border: "var(--scout-border)",
                fontFamily: fontSans,
                fontSize: 14,
              }}
            />
          </label>
          <ScoutPrimaryBtn
            onClick={() => assign()}
            disabled={!clientId || loading}
            style={{ minHeight: 40, alignSelf: "flex-start" }}
          >
            {loading ? "Saving…" : "Assign client"}
          </ScoutPrimaryBtn>
        </div>

        {clients.length === 0 && (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "12px 0 0" }}>
            Could not load client list. Refresh or check Admin → Clients.
          </p>
        )}

        {error && <p style={{ fontFamily: fontSans, fontSize: 13, color: "#dc2626", margin: "12px 0 0" }}>{error}</p>}
      </div>
    </ScoutBox>
  );
}

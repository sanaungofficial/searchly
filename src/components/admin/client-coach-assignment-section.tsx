"use client";

import { useEffect, useMemo, useState } from "react";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { InternalCoachBadge } from "@/components/scout/internal-coach-badge";
import { ScoutPrimaryBtn, ScoutSecondaryBtn, ScoutBox } from "@/components/scout/scout-box";
import type { AdminClient } from "@/components/admin/admin-clients-panel";
import { border, color, fontMono, fontSans, surface } from "@/lib/typography";

type CoachOption = {
  id: string;
  displayName: string;
  isInternal: boolean;
  slug: string | null;
  status?: string;
};

export function ClientCoachAssignmentSection({
  client,
  onUpdated,
}: {
  client: AdminClient;
  onUpdated: (client: AdminClient) => void;
}) {
  const assignments = client.coachAssignments ?? [];
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [coachId, setCoachId] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/coaches")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCoaches(
          list
            .filter((c: CoachOption) => c.status === "ACTIVE")
            .map((c: CoachOption) => ({
              id: c.id,
              displayName: c.displayName,
              isInternal: c.isInternal ?? false,
              slug: c.slug,
              status: c.status,
            }))
            .sort((a, b) => {
              if (a.isInternal !== b.isInternal) return a.isInternal ? -1 : 1;
              return a.displayName.localeCompare(b.displayName);
            }),
        );
      })
      .catch(() => setCoaches([]));
  }, []);

  const assignedIds = new Set(assignments.map((a) => a.coachProfile.id));
  const available = coaches.filter((c) => !assignedIds.has(c.id));

  const filteredAvailable = useMemo(() => {
    const q = coachSearch.trim().toLowerCase();
    if (!q) return available.slice(0, 12);
    return available
      .filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          (c.isInternal && (q.includes("kimchi") || q.includes("second") || q.includes("internal"))),
      )
      .slice(0, 12);
  }, [available, coachSearch]);

  async function assign(id?: string) {
    const targetId = id ?? coachId;
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/coach-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachProfileId: targetId, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not assign coach");
      onUpdated(data.client as AdminClient);
      setCoachId("");
      setCoachSearch("");
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function remove(coachProfileId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${client.id}/coach-assignment?coachProfileId=${encodeURIComponent(coachProfileId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not remove assignment");
      onUpdated(data.client as AdminClient);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScoutBox padding={0} style={{ marginBottom: 20, overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "var(--scout-border)" }}>
        <p style={{ fontSize: 12, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, margin: 0 }}>
          Assigned coaches
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.stone, margin: "6px 0 0", lineHeight: 1.45 }}>
          Coaches working with this client. Remove only unassigns — use Admin → Coaches → Inactive to delist from the site.
        </p>
      </div>
      <div style={{ padding: "16px 20px" }}>
        {assignments.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "0 0 16px" }}>
            No coaches assigned yet. Search below to assign Kimchi or marketplace coaches.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {assignments.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  border: "var(--scout-border)",
                  background: "rgba(26,58,47,0.02)",
                }}
              >
                <CoachAvatar name={a.coachProfile.displayName} photoUrl={a.coachProfile.photoUrl} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
                    {a.coachProfile.displayName}
                    {a.coachProfile.isInternal && <InternalCoachBadge compact />}
                    <span style={{ fontFamily: fontMono, fontSize: 10, color: color.forest, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Working together
                    </span>
                  </p>
                  {a.coachProfile.headline && (
                    <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0, lineHeight: 1.4 }}>
                      {a.coachProfile.headline.slice(0, 120)}
                      {a.coachProfile.headline.length > 120 ? "…" : ""}
                    </p>
                  )}
                  {a.notes && (
                    <p style={{ fontFamily: fontSans, fontSize: 12, color: color.stone, margin: "6px 0 0" }}>Note: {a.notes}</p>
                  )}
                </div>
                <ScoutSecondaryBtn onClick={() => remove(a.coachProfile.id)} disabled={loading} style={{ minHeight: 36, fontSize: 13 }}>
                  Remove from list
                </ScoutSecondaryBtn>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontFamily: fontSans, fontSize: 13, color: color.stone }}>
            Search coaches to assign
            <input
              type="search"
              value={coachSearch}
              onChange={(e) => {
                setCoachSearch(e.target.value);
                setCoachId("");
              }}
              placeholder="Name or Kimchi coach…"
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
          {coachSearch.trim() && filteredAvailable.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
              {filteredAvailable.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCoachId(c.id);
                    setCoachSearch(c.displayName);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    border: coachId === c.id ? `2px solid ${color.forest}` : "var(--scout-border)",
                    background: coachId === c.id ? "rgba(26,58,47,0.06)" : surface.card,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink }}>
                    {c.displayName}
                  </span>
                  {c.isInternal && <InternalCoachBadge compact />}
                </button>
              ))}
            </div>
          )}
          {coachSearch.trim() && filteredAvailable.length === 0 && (
            <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>No matching active coaches.</p>
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
            disabled={!coachId || loading}
            style={{ minHeight: 40, alignSelf: "flex-start" }}
          >
            {loading ? "Saving…" : "Assign coach"}
          </ScoutPrimaryBtn>
        </div>

        {coaches.length === 0 && (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "12px 0 0" }}>
            Could not load coach list. Refresh or check Admin → Coaches.
          </p>
        )}

        {error && <p style={{ fontFamily: fontSans, fontSize: 13, color: "#dc2626", margin: "12px 0 0" }}>{error}</p>}
      </div>
    </ScoutBox>
  );
}

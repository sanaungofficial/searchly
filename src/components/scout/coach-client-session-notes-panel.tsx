"use client";

import { useCallback, useEffect, useState } from "react";
import type { CoachClientSessionNoteView } from "@/lib/coach-client-session-notes";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontMono, fontSans, surface } from "@/lib/typography";

type AssignedCoachOption = { coachProfileId: string; displayName: string };

type Props = {
  clientUserId: string;
  mode: "coach" | "admin";
  assignedCoaches?: AssignedCoachOption[];
  compact?: boolean;
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 88,
  marginTop: 6,
  padding: "10px 12px",
  border: border.line,
  fontFamily: fontSans,
  fontSize: 13,
  boxSizing: "border-box",
  resize: "vertical",
  background: "#fff",
};

export function CoachClientSessionNotesPanel({
  clientUserId,
  mode,
  assignedCoaches = [],
  compact = false,
}: Props) {
  const [notes, setNotes] = useState<CoachClientSessionNoteView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionNotes, setSessionNotes] = useState("");
  const [homework, setHomework] = useState("");
  const [coachProfileId, setCoachProfileId] = useState(assignedCoaches[0]?.coachProfileId ?? "");
  const [coachOptions, setCoachOptions] = useState<AssignedCoachOption[]>(assignedCoaches);

  const listUrl =
    mode === "coach"
      ? `/api/coach/clients/${clientUserId}/session-notes`
      : `/api/admin/clients/${clientUserId}/session-notes`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = mode === "admin" && coachProfileId ? `?coachProfileId=${encodeURIComponent(coachProfileId)}` : "";
      const res = await fetch(`${listUrl}${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load notes");
      setNotes(data.notes ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notes");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl, mode, coachProfileId]);

  useEffect(() => {
    if (mode !== "admin") return;
    fetch("/api/admin/coaches")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const opts = list
          .filter((c: { status?: string }) => c.status === "ACTIVE" || !c.status)
          .map((c: { id: string; displayName: string }) => ({
            coachProfileId: c.id,
            displayName: c.displayName,
          }));
        setCoachOptions(opts);
        if (opts.length && !coachProfileId) setCoachProfileId(opts[0].coachProfileId);
      })
      .catch(() => {
        if (assignedCoaches.length) setCoachOptions(assignedCoaches);
      });
  }, [mode, assignedCoaches, coachProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (mode === "admin" && !coachProfileId) {
      setError("Select which expert this note is from.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(listUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionNotes: sessionNotes.trim() || null,
          homework: homework.trim() || null,
          ...(mode === "admin" ? { coachProfileId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save");
      setSessionNotes("");
      setHomework("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(noteId: string) {
    setError(null);
    const deleteUrl =
      mode === "coach"
        ? `/api/coach/clients/${clientUserId}/session-notes/${noteId}`
        : `/api/admin/clients/${clientUserId}/session-notes/${noteId}?coachProfileId=${encodeURIComponent(coachProfileId)}`;
    const res = await fetch(deleteUrl, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not remove");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  const options = coachOptions.length > 0 ? coachOptions : assignedCoaches;

  return (
    <ScoutBox padding={compact ? 16 : 20} style={{ marginTop: compact ? 12 : 20 }}>
      <p style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 12px" }}>
        Session notes & homework
      </p>
      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
        Share what happened in a session and optional follow-up work. Your client sees this under Profile → Coach.
      </p>

      {mode === "admin" && options.length > 0 && (
        <label style={{ display: "block", marginBottom: 12, fontFamily: fontSans, fontSize: 13 }}>
          Posting as expert
          <select
            value={coachProfileId}
            onChange={(e) => setCoachProfileId(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              border: border.line,
              fontFamily: fontSans,
              fontSize: 13,
              background: surface.card,
            }}
          >
            {options.map((c) => (
              <option key={c.coachProfileId} value={c.coachProfileId}>{c.displayName}</option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <label style={{ fontFamily: fontSans, fontSize: 13 }}>
          Session notes
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="What you covered, key takeaways, next steps…"
            style={textareaStyle}
          />
        </label>
        <label style={{ fontFamily: fontSans, fontSize: 13 }}>
          Homework (optional)
          <textarea
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
            placeholder="Optional assignments before your next session…"
            style={textareaStyle}
          />
        </label>
      </div>

      <ScoutPrimaryBtn onClick={save} disabled={saving} style={{ minHeight: 40, marginBottom: 16 }}>
        {saving ? "Saving…" : "Share with client"}
      </ScoutPrimaryBtn>

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b45309", margin: "0 0 12px" }}>{error}</p>
      )}

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>Loading notes…</p>
      ) : notes.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>No session notes yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notes.map((note) => (
            <div
              key={note.id}
              style={{
                padding: "12px 14px",
                border: border.line,
                background: surface.inset,
              }}
            >
              <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 8px" }}>
                {new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                {mode === "admin" ? ` · ${note.coachName}` : ""}
                {note.sessionTitle ? ` · ${note.sessionTitle}` : ""}
              </p>
              {note.sessionNotes && (
                <div style={{ marginBottom: note.homework ? 10 : 0 }}>
                  <p style={{ fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 4px" }}>
                    Session notes
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                    {note.sessionNotes}
                  </p>
                </div>
              )}
              {note.homework && (
                <div>
                  <p style={{ fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 4px" }}>
                    Homework
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                    {note.homework}
                  </p>
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <ScoutSecondaryBtn onClick={() => remove(note.id)} style={{ minHeight: 32, fontSize: 12, padding: "6px 10px" }}>
                  Remove
                </ScoutSecondaryBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScoutBox>
  );
}

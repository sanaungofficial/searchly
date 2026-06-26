"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CoachClientSessionNoteView } from "@/lib/coach-client-session-notes";
import { border, color, fontMono, fontSans, surface } from "@/lib/typography";

export function ClientCoachSessionNotes({
  coachProfileId,
  coachName,
  compact = false,
}: {
  coachProfileId?: string;
  coachName?: string;
  compact?: boolean;
}) {
  const { withClientScope } = useWorkspace();
  const [notes, setNotes] = useState<CoachClientSessionNoteView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = coachProfileId ? `?coachProfileId=${encodeURIComponent(coachProfileId)}` : "";
    fetch(withClientScope(`/api/coaching/session-notes${q}`))
      .then((r) => (r.ok ? r.json() : { notes: [] }))
      .then((d) => setNotes(d.notes ?? []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [coachProfileId, withClientScope]);

  if (loading) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: compact ? "12px 0 0" : "0" }}>
        Loading session notes…
      </p>
    );
  }

  if (notes.length === 0) return null;

  return (
    <div style={{ marginTop: compact ? 14 : 0 }}>
      {!compact && (
        <p
          style={{
            fontFamily: fontMono,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: color.muted,
            margin: "0 0 10px",
          }}
        >
          {coachName ? `Notes from ${coachName}` : "Session notes from your experts"}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notes.map((note) => (
          <div
            key={note.id}
            style={{
              padding: compact ? "10px 12px" : "12px 14px",
              border: border.line,
              background: surface.inset,
            }}
          >
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 8px" }}>
              {new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              {!coachProfileId && ` · ${note.coachName}`}
            </p>
            {note.sessionNotes && (
              <div style={{ marginBottom: note.homework ? 8 : 0 }}>
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
          </div>
        ))}
      </div>
    </div>
  );
}

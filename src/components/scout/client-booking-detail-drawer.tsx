"use client";

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { ScoutBox, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { useWorkspaceDrawerLayout } from "@/hooks/use-workspace-drawer-layout";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CoachClientSessionNoteView } from "@/lib/coach-client-session-notes";
import type { CoachSharedDocumentView } from "@/lib/coach-shared-documents";
import {
  bookingStatusColor,
  bookingStatusLabel,
  formatBookingWhen,
} from "@/lib/booking-display";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";

const DRAWER_WIDTH = "min(720px, calc(100vw - 16px))";

type BookingDetail = {
  id: string;
  coachProfileId: string;
  coachName: string;
  coachSlug: string | null;
  coachPhotoUrl: string | null;
  title: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  status: string;
  nylasBookingRef: string | null;
  durationMinutes: number;
};

type ClientExchangeNote = {
  userId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
};

type Props = {
  bookingId: string;
  onClose: () => void;
};

export function ClientBookingDetailDrawer({ bookingId, onClose }: Props) {
  const { isMobile, backdropStyle, panelStyle } = useWorkspaceDrawerLayout();
  const router = useRouter();
  const { withClientScope } = useWorkspace();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [sessionNotes, setSessionNotes] = useState<CoachClientSessionNoteView[]>([]);
  const [clientNotes, setClientNotes] = useState<ClientExchangeNote[]>([]);
  const [documents, setDocuments] = useState<CoachSharedDocumentView[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(withClientScope(`/api/bookings/${encodeURIComponent(bookingId)}`))
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load booking");
        return r.json();
      })
      .then((d) => {
        setBooking(d.booking);
        setSessionNotes(d.sessionNotes ?? []);
        setClientNotes(d.clientExchangeNotes ?? []);
        setDocuments(d.documents ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [bookingId, withClientScope]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitNote(e: FormEvent) {
    e.preventDefault();
    const text = noteDraft.trim();
    if (!text) return;
    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch(withClientScope(`/api/bookings/${encodeURIComponent(bookingId)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientNote: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save note");
      setClientNotes((prev) => [...prev, data.note]);
      setNoteDraft("");
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingNote(false);
    }
  }

  const when = booking ? formatBookingWhen(booking.startAt, booking.endAt) : null;
  const statusStyle = booking ? bookingStatusColor(booking.status) : null;
  const isUpcoming = booking ? new Date(booking.startAt) >= new Date() : false;

  return (
    <>
      <div
        onClick={close}
        style={{ ...backdropStyle, background: "rgba(0,0,0,0.18)", zIndex: DRAWER_BACKDROP_Z }}
      />
      <div
        style={{
          ...panelStyle,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.page,
          zIndex: DRAWER_Z,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: isMobile ? "12px 16px" : "14px 20px",
            background: surface.card,
            borderBottom: "var(--scout-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2 style={{ ...displayTitleStyle(18), margin: 0 }}>Booking details</h2>
          <button type="button" onClick={close} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 16 : 24 }}>
          {loading && <p style={{ fontFamily: fontSans, color: color.muted }}>Loading…</p>}
          {error && <p style={{ fontFamily: fontSans, color: "#dc2626" }}>{error}</p>}

          {booking && when && statusStyle && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <CoachAvatar name={booking.coachName} photoUrl={booking.coachPhotoUrl} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>
                    {booking.title ?? "Coaching booking"}
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0, lineHeight: 1.5 }}>
                    with {booking.coachName}
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
                    {when.date} · {when.time} · {booking.durationMinutes} min
                  </p>
                </div>
                <span
                  style={{
                    alignSelf: "flex-start",
                    fontSize: 11,
                    fontFamily: fontMono,
                    padding: "3px 8px",
                    background: statusStyle.bg,
                    color: statusStyle.color,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    flexShrink: 0,
                  }}
                >
                  {bookingStatusLabel(booking.status)}
                </span>
              </div>

              {booking.location && (
                <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 16px", lineHeight: 1.5 }}>
                  Location: {booking.location}
                </p>
              )}

              {isUpcoming && booking.nylasBookingRef && booking.status !== "CANCELLED" && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                  <button
                    type="button"
                    onClick={() => router.push(`/coaching/reschedule/${encodeURIComponent(booking.nylasBookingRef!)}`)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontFamily: fontSans,
                      fontSize: 13,
                      fontWeight: 600,
                      color: color.forest,
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/coaching/cancel/${encodeURIComponent(booking.nylasBookingRef!)}`)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontFamily: fontSans,
                      fontSize: 13,
                      color: color.muted,
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    Cancel booking
                  </button>
                </div>
              )}

              <SectionLabel>Exchange notes</SectionLabel>
              <ScoutBox padding={16} style={{ marginBottom: 24 }}>
                {sessionNotes.length === 0 && clientNotes.length === 0 && (
                  <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
                    No notes yet. Your coach may add session notes after the call — you can also leave notes here.
                  </p>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: sessionNotes.length + clientNotes.length > 0 ? 16 : 0 }}>
                  {sessionNotes.map((note) => (
                    <NoteBubble
                      key={note.id}
                      author={note.createdByName ?? booking.coachName}
                      when={note.createdAt}
                      label="From coach"
                    >
                      {note.sessionNotes && <p style={noteBodyStyle}>{note.sessionNotes}</p>}
                      {note.homework && (
                        <>
                          <p style={noteLabelStyle}>Homework</p>
                          <p style={noteBodyStyle}>{note.homework}</p>
                        </>
                      )}
                    </NoteBubble>
                  ))}
                  {clientNotes.map((note, i) => (
                    <NoteBubble
                      key={`${note.createdAt}-${i}`}
                      author={note.authorName ?? "You"}
                      when={note.createdAt}
                      label="From you"
                    >
                      <p style={noteBodyStyle}>{note.body}</p>
                    </NoteBubble>
                  ))}
                </div>

                <form onSubmit={submitNote}>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Add a note for your coach…"
                    rows={3}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      border: border.line,
                      borderRadius: 0,
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      color: color.ink,
                      resize: "vertical",
                      marginBottom: 10,
                    }}
                  />
                  {noteError && (
                    <p style={{ fontFamily: fontSans, fontSize: 12, color: "#dc2626", margin: "0 0 8px" }}>{noteError}</p>
                  )}
                  <ScoutPrimaryBtn type="submit" disabled={savingNote || !noteDraft.trim()} style={{ minHeight: 38 }}>
                    {savingNote ? "Saving…" : "Add note"}
                  </ScoutPrimaryBtn>
                </form>
              </ScoutBox>

              <SectionLabel>Files</SectionLabel>
              <ScoutBox padding={16}>
                {documents.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "flex-start",
                          padding: "10px 12px",
                          border: border.line,
                          background: surface.inset,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>{doc.name}</p>
                          <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>
                            {doc.typeLabel}
                            {doc.uploadedByName ? ` · from ${doc.uploadedByName}` : ""}
                          </p>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest, flexShrink: 0 }}
                        >
                          Open →
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
                    No files shared for this coach yet.
                  </p>
                )}
                <p style={{ fontFamily: fontSans, fontSize: 12, color: color.stone, margin: 0, lineHeight: 1.5 }}>
                  Uploading files from your side isn&apos;t available yet — ask your coach to share materials, or check Coaching → Resources.
                </p>
              </ScoutBox>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </p>
  );
}

function NoteBubble({
  author,
  when,
  label,
  children,
}: {
  author: string;
  when: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "10px 12px", border: border.line, background: surface.inset }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest, margin: 0 }}>
          {author}
          <span style={{ fontWeight: 500, color: color.muted }}> · {label}</span>
        </p>
        <span style={{ fontFamily: fontMono, fontSize: 10, color: color.stone, flexShrink: 0 }}>
          {new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      </div>
      {children}
    </div>
  );
}

const noteLabelStyle: CSSProperties = {
  fontFamily: fontMono,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: color.muted,
  margin: "8px 0 4px",
};

const noteBodyStyle: CSSProperties = {
  fontFamily: fontSans,
  fontSize: 14,
  color: color.stone,
  margin: 0,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
};

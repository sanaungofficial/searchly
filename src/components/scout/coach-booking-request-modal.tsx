"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { ScoutSecondaryBtn, scoutFieldStyle } from "@/components/scout/scout-box";
import type { CoachBookingAvailability } from "@/lib/coach-types";
import { color, fontSans, displayTitleStyle } from "@/lib/typography";
import { DRAWER_NESTED_BACKDROP_Z, DRAWER_NESTED_Z } from "@/lib/z-layers";

export type CoachBookingRequestSessionType = "intro" | "session";

type ConceptualSlot = { startTime: number; endTime: number };

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  coachDisplayName: string;
  coachPhotoUrl: string | null;
  sessionDurationMinutes: number;
  availability: CoachBookingAvailability | null;
  initialSessionType?: CoachBookingRequestSessionType;
  guestName?: string;
  onSubmitted?: () => void;
};

type Step = "type" | "times" | "confirm" | "success";

const INTRO_MINUTES = 30;
const line = "1px solid rgba(26,58,47,0.12)";

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatSlotLabel(startSec: number, endSec: number): string {
  const start = new Date(startSec * 1000);
  const end = new Date(endSec * 1000);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dayFmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  return `${dayFmt.format(start)} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}

export function CoachBookingRequestModal({
  open,
  onClose,
  slug,
  coachDisplayName,
  coachPhotoUrl,
  sessionDurationMinutes,
  availability,
  initialSessionType = "intro",
  guestName,
  onSubmitted,
}: Props) {
  const [step, setStep] = useState<Step>("type");
  const [sessionType, setSessionType] = useState<CoachBookingRequestSessionType>(initialSessionType);
  const [weekStart, setWeekStart] = useState(() => startOfLocalDay(new Date()));
  const [slots, setSlots] = useState<ConceptualSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTimes, setSelectedTimes] = useState<ConceptualSlot[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const firstName = coachDisplayName.split(" ")[0];

  const reset = useCallback(() => {
    setStep("type");
    setSessionType(initialSessionType);
    setWeekStart(startOfLocalDay(new Date()));
    setSlots([]);
    setSelectedTimes([]);
    setMessage("");
    setError(null);
    setSubmitting(false);
  }, [initialSessionType]);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    setSessionType(initialSessionType);
  }, [open, initialSessionType]);

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setError(null);
    try {
      const startSec = Math.floor(weekStart.getTime() / 1000);
      const endSec = Math.floor(addDays(weekStart, 7).getTime() / 1000);
      const durationMinutes = sessionType === "intro" ? INTRO_MINUTES : sessionDurationMinutes;
      const res = await fetch(
        `/api/coaches/${encodeURIComponent(slug)}/conceptual-availability?startTime=${startSec}&endTime=${endSec}&durationMinutes=${durationMinutes}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load typical hours");
      setSlots(data.slots ?? []);
    } catch (err) {
      setSlots([]);
      setError(err instanceof Error ? err.message : "Could not load typical hours");
    } finally {
      setLoadingSlots(false);
    }
  }, [slug, weekStart, sessionType, sessionDurationMinutes]);

  useEffect(() => {
    if (!open || step !== "times") return;
    loadSlots();
  }, [open, step, loadSlots]);

  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, ConceptualSlot[]>();
    for (const day of weekDays) map.set(day.toDateString(), []);
    for (const slot of slots) {
      const key = startOfLocalDay(new Date(slot.startTime * 1000)).toDateString();
      if (map.has(key)) map.get(key)!.push(slot);
    }
    return map;
  }, [slots, weekDays]);

  function toggleSlot(slot: ConceptualSlot) {
    setSelectedTimes((prev) => {
      const exists = prev.some((s) => s.startTime === slot.startTime);
      if (exists) return prev.filter((s) => s.startTime !== slot.startTime);
      if (prev.length >= 3) return prev;
      return [...prev, slot].sort((a, b) => a.startTime - b.startTime);
    });
  }

  async function submitRequest() {
    if (!selectedTimes.length) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/coaches/${encodeURIComponent(slug)}/booking-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionType,
          preferredTimes: selectedTimes,
          message: message.trim() || undefined,
          guestName,
          timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setStep("success");
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: DRAWER_NESTED_BACKDROP_Z }}
      />
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(920px, calc(100vw - 24px))",
          maxHeight: "min(90vh, 720px)",
          background: "#fff",
          border: "2px solid #1A1A1A",
          zIndex: DRAWER_NESTED_Z,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: line,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <p style={{ ...displayTitleStyle(18), margin: 0 }}>
            {step === "success" ? "Request sent" : `Request to book with ${coachDisplayName}`}
          </p>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: color.muted }}>
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", display: "flex", minHeight: 0 }}>
          {step === "type" && (
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              <div style={{ width: "38%", padding: 24, borderRight: line, background: "rgba(26,58,47,0.03)" }}>
                <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>
                  Request a time with {firstName}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "0 0 12px", lineHeight: 1.55 }}>
                  {firstName} will confirm availability — this is not an instant booking.
                </p>
                {availability?.summary && (
                  <p style={{ fontFamily: fontSans, fontSize: 13, color: color.stone, margin: 0, lineHeight: 1.5 }}>
                    <strong>Typical hours:</strong> {availability.summary}
                  </p>
                )}
                {availability?.availabilityNotes && (
                  <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "10px 0 0", lineHeight: 1.5 }}>
                    {availability.availabilityNotes}
                  </p>
                )}
              </div>
              <div style={{ flex: 1, padding: 24 }}>
                <SessionTypeOption
                  selected={sessionType === "intro"}
                  title="Request a free intro call"
                  subtitle={`Explore ${firstName}'s coaching — ${INTRO_MINUTES} min`}
                  onSelect={() => setSessionType("intro")}
                />
                <SessionTypeOption
                  selected={sessionType === "session"}
                  title="Request a coaching session"
                  subtitle={`Work with ${firstName} — ${sessionDurationMinutes} min`}
                  onSelect={() => setSessionType("session")}
                />
              </div>
            </div>
          )}

          {step === "times" && (
            <div style={{ flex: 1, padding: 24, minWidth: 0 }}>
              <p style={{ fontFamily: fontSans, fontSize: 14, margin: "0 0 4px", color: color.stone, lineHeight: 1.5 }}>
                <strong>Pick up to 3 preferred times</strong> within {firstName}&apos;s typical hours. All times in {timezone}.
              </p>
              {availability?.summary && (
                <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 16px" }}>
                  {availability.summary}
                </p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontFamily: fontSans, fontSize: 13, margin: 0, color: color.muted }}>
                  {selectedTimes.length}/3 selected
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setWeekStart((w) => addDays(w, -7))} style={navBtnStyle} aria-label="Previous week">‹</button>
                  <button type="button" onClick={() => setWeekStart((w) => addDays(w, 7))} style={navBtnStyle} aria-label="Next week">›</button>
                </div>
              </div>

              {loadingSlots ? (
                <p style={{ fontFamily: fontSans, color: color.muted }}>Loading typical hours…</p>
              ) : error ? (
                <p style={{ fontFamily: fontSans, color: "#b45309" }}>{error}</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, minHeight: 200 }}>
                  {weekDays.map((day) => {
                    const key = day.toDateString();
                    const daySlots = slotsByDay.get(key) ?? [];
                    const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(day);
                    return (
                      <div key={key} style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, margin: "0 0 10px", color: color.stone }}>{dayLabel}</p>
                        {daySlots.length === 0 ? (
                          <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>—</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {daySlots.map((slot) => {
                              const selected = selectedTimes.some((s) => s.startTime === slot.startTime);
                              const timeLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(slot.startTime * 1000));
                              return (
                                <button
                                  key={slot.startTime}
                                  type="button"
                                  onClick={() => toggleSlot(slot)}
                                  style={{
                                    padding: "8px 6px",
                                    border: selected ? "2px solid #1A3A2F" : line,
                                    background: selected ? "#fff" : "rgba(26,58,47,0.06)",
                                    fontFamily: fontSans,
                                    fontSize: 13,
                                    fontWeight: selected ? 600 : 500,
                                    color: color.forest,
                                    cursor: "pointer",
                                  }}
                                >
                                  {timeLabel}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === "confirm" && (
            <div style={{ flex: 1, padding: 24, display: "flex", gap: 24 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 8px" }}>Your request</p>
                <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>
                  {sessionType === "intro" ? "Free intro call" : "Coaching session"}
                </p>
                <ul style={{ margin: "0 0 16px", paddingLeft: 18, fontFamily: fontSans, fontSize: 14, color: color.stone, lineHeight: 1.6 }}>
                  {selectedTimes.map((slot) => (
                    <li key={slot.startTime}>{formatSlotLabel(slot.startTime, slot.endTime)}</li>
                  ))}
                </ul>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <CoachAvatar name={coachDisplayName} photoUrl={coachPhotoUrl} size={44} />
                  <p style={{ fontFamily: fontSans, fontSize: 14, margin: 0 }}>with {coachDisplayName}</p>
                </div>
                <label style={{ display: "block", fontFamily: fontSans, fontSize: 13 }}>
                  <span style={{ display: "block", marginBottom: 6, color: color.muted }}>
                    Anything you&apos;d like {firstName} to know? (optional)
                  </span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Goals for this session, questions to cover, context from your job search…"
                    style={{ ...scoutFieldStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }}
                  />
                </label>
              </div>
              <div style={{ width: 280, border: line, padding: 20, background: "rgba(26,58,47,0.03)" }}>
                <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>What happens next</p>
                <p style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, margin: 0, lineHeight: 1.6 }}>
                  {firstName} will review your preferred times and confirm by email. No charge until you agree on a session.
                </p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div style={{ flex: 1, padding: 32, textAlign: "center" }}>
              <CoachAvatar name={coachDisplayName} photoUrl={coachPhotoUrl} size={72} />
              <p style={{ ...displayTitleStyle(22), margin: "20px 0 8px" }}>Request sent!</p>
              <p style={{ fontFamily: fontSans, fontSize: 15, color: color.stone, margin: "0 0 8px", lineHeight: 1.6 }}>
                {firstName} will confirm a time or suggest alternatives. Check your email for a copy of your request.
              </p>
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: line,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {error && step !== "times" && (
              <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b45309", margin: 0 }}>{error}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {step !== "success" && step !== "type" && (
              <ScoutSecondaryBtn
                onClick={() => {
                  if (step === "confirm") setStep("times");
                  else if (step === "times") setStep("type");
                }}
              >
                Back
              </ScoutSecondaryBtn>
            )}
            {step === "type" && <ContinueBtn onClick={() => setStep("times")}>Continue</ContinueBtn>}
            {step === "times" && (
              <ContinueBtn disabled={!selectedTimes.length} onClick={() => setStep("confirm")}>
                Continue
              </ContinueBtn>
            )}
            {step === "confirm" && (
              <ContinueBtn disabled={submitting} onClick={submitRequest}>
                {submitting ? "Sending…" : "Submit request"}
              </ContinueBtn>
            )}
            {step === "success" && <ContinueBtn onClick={onClose}>Done</ContinueBtn>}
          </div>
        </div>
      </div>
    </>
  );
}

function SessionTypeOption({
  selected,
  title,
  subtitle,
  onSelect,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 16,
        marginBottom: 10,
        border: selected ? "2px solid #1A1A1A" : line,
        background: selected ? "rgba(26,58,47,0.04)" : "#fff",
        cursor: "pointer",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "2px solid #1A1A1A",
          flexShrink: 0,
          marginTop: 2,
          background: selected ? "#1A1A1A" : "transparent",
          boxShadow: selected ? "inset 0 0 0 3px #fff" : "none",
        }}
      />
      <span>
        <span style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, display: "block" }}>{title}</span>
        <span style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>{subtitle}</span>
      </span>
    </button>
  );
}

function ContinueBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "12px 28px",
        background: disabled ? "rgba(232,213,163,0.5)" : "#E8D5A3",
        color: "#1A1A1A",
        border: "2px solid #1A1A1A",
        fontFamily: fontSans,
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth: 120,
      }}
    >
      {children}
    </button>
  );
}

const navBtnStyle: CSSProperties = {
  width: 36,
  height: 36,
  border: line,
  background: "#fff",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
};

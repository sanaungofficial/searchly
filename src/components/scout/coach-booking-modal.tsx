"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, fontSans, displayTitleStyle } from "@/lib/typography";

export type CoachBookingSessionType = "intro" | "session";

type Slot = { startTime: number; endTime: number };

type Props = {
  open: boolean;
  onClose: () => void;
  slug: string;
  coachDisplayName: string;
  coachPhotoUrl: string | null;
  hourlyRate: number | null;
  sessionDurationMinutes: number;
  initialSessionType?: CoachBookingSessionType;
  guestName?: string;
  onBooked?: () => void;
};

type Step = "type" | "calendar" | "confirm" | "success";

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

function formatNextAvailable(startSec: number): string {
  const d = new Date(startSec * 1000);
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
  const tzShort =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(d)
      .find((p) => p.type === "timeZoneName")?.value ?? tz;
  return `Available ${dayFmt.format(d)} at ${timeFmt.format(d)} ${tzShort}`;
}

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

const INTRO_MINUTES = 30;
const line = "1px solid rgba(26,58,47,0.12)";

export function CoachBookingModal({
  open,
  onClose,
  slug,
  coachDisplayName,
  coachPhotoUrl,
  hourlyRate,
  sessionDurationMinutes,
  initialSessionType = "intro",
  guestName,
  onBooked,
}: Props) {
  const [step, setStep] = useState<Step>("type");
  const [sessionType, setSessionType] = useState<CoachBookingSessionType>(initialSessionType);
  const [weekStart, setWeekStart] = useState(() => startOfLocalDay(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationMinutes = sessionType === "intro" ? INTRO_MINUTES : sessionDurationMinutes;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const reset = useCallback(() => {
    setStep("type");
    setSessionType(initialSessionType);
    setWeekStart(startOfLocalDay(new Date()));
    setSlots([]);
    setSelectedSlot(null);
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
      const res = await fetch(
        `/api/coaches/${encodeURIComponent(slug)}/availability?startTime=${startSec}&endTime=${endSec}&durationMinutes=${durationMinutes}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load times");
      setSlots(data.slots ?? []);
    } catch (err) {
      setSlots([]);
      setError(err instanceof Error ? err.message : "Could not load times");
    } finally {
      setLoadingSlots(false);
    }
  }, [slug, weekStart, durationMinutes]);

  useEffect(() => {
    if (!open || step !== "calendar") return;
    loadSlots();
  }, [open, step, loadSlots]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const day of weekDays) {
      const key = day.toDateString();
      map.set(key, []);
    }
    for (const slot of slots) {
      const d = new Date(slot.startTime * 1000);
      const key = startOfLocalDay(d).toDateString();
      if (map.has(key)) map.get(key)!.push(slot);
    }
    return map;
  }, [slots, weekDays]);

  async function confirmBooking() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/coaches/${encodeURIComponent(slug)}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          sessionType,
          guestName,
          timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      setStep("success");
      onBooked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const firstName = coachDisplayName.split(" ")[0];

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 80 }}
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
          zIndex: 90,
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
            {step === "success" ? "You're booked" : `Book with ${coachDisplayName}`}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: color.muted }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", display: "flex", minHeight: 0 }}>
          {step === "type" && (
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              <div
                style={{
                  width: "38%",
                  padding: 24,
                  borderRight: line,
                  background: "rgba(26,58,47,0.03)",
                }}
              >
                <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>
                  Take the first step toward your goals.
                </p>
                <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0 }}>
                  Select a session type below.
                </p>
              </div>
              <div style={{ flex: 1, padding: 24 }}>
                <SessionTypeOption
                  selected={sessionType === "intro"}
                  title="Book a free intro call"
                  subtitle={`Explore ${firstName}'s coaching — ${INTRO_MINUTES} min`}
                  onSelect={() => setSessionType("intro")}
                />
                <SessionTypeOption
                  selected={sessionType === "session"}
                  title="Book a session"
                  subtitle={`Work with ${firstName} — ${sessionDurationMinutes} min`}
                  onSelect={() => setSessionType("session")}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
                  <label style={{ fontFamily: fontSans, fontSize: 13 }}>
                    <span style={{ display: "block", marginBottom: 6, color: color.muted }}>Duration</span>
                    <select
                      value={durationMinutes}
                      disabled
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: line,
                        fontFamily: fontSans,
                        fontSize: 14,
                        background: "#fff",
                      }}
                    >
                      <option value={durationMinutes}>
                        {durationMinutes >= 60
                          ? `${durationMinutes / 60} hour${durationMinutes > 60 ? "s" : ""}`
                          : `${durationMinutes} minutes`}
                      </option>
                    </select>
                  </label>
                  <label style={{ fontFamily: fontSans, fontSize: 13 }}>
                    <span style={{ display: "block", marginBottom: 6, color: color.muted }}>Recurrence</span>
                    <select
                      disabled
                      value="none"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: line,
                        fontFamily: fontSans,
                        fontSize: 14,
                        background: "#fff",
                      }}
                    >
                      <option value="none">Does not repeat</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === "calendar" && (
            <div style={{ flex: 1, padding: 24, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <p style={{ fontFamily: fontSans, fontSize: 14, margin: 0, color: color.stone }}>
                  <strong>{coachDisplayName}&apos;s calendar</strong> · All times in {timezone}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setWeekStart((w) => addDays(w, -7))}
                    style={navBtnStyle}
                    aria-label="Previous week"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekStart((w) => addDays(w, 7))}
                    style={navBtnStyle}
                    aria-label="Next week"
                  >
                    ›
                  </button>
                </div>
              </div>

              {loadingSlots ? (
                <p style={{ fontFamily: fontSans, color: color.muted }}>Loading available times…</p>
              ) : error ? (
                <p style={{ fontFamily: fontSans, color: "#b45309" }}>{error}</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, minHeight: 200 }}>
                  {weekDays.map((day) => {
                    const key = day.toDateString();
                    const daySlots = slotsByDay.get(key) ?? [];
                    const dayLabel = new Intl.DateTimeFormat("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    }).format(day);
                    return (
                      <div key={key} style={{ minWidth: 0 }}>
                        <p
                          style={{
                            fontFamily: fontSans,
                            fontSize: 12,
                            fontWeight: 600,
                            margin: "0 0 10px",
                            color: color.stone,
                          }}
                        >
                          {dayLabel}
                        </p>
                        {daySlots.length === 0 ? (
                          <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>Fully booked</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {daySlots.map((slot) => {
                              const selected =
                                selectedSlot?.startTime === slot.startTime &&
                                selectedSlot?.endTime === slot.endTime;
                              const timeLabel = new Intl.DateTimeFormat("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              }).format(new Date(slot.startTime * 1000));
                              return (
                                <button
                                  key={slot.startTime}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
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

          {step === "confirm" && selectedSlot && (
            <div style={{ flex: 1, padding: 24, display: "flex", gap: 24 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 8px" }}>Your session</p>
                <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>
                  {sessionType === "intro" ? "Free intro call" : "Coaching session"}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, margin: "0 0 16px" }}>
                  {formatSlotLabel(selectedSlot.startTime, selectedSlot.endTime)}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <CoachAvatar name={coachDisplayName} photoUrl={coachPhotoUrl} size={44} />
                  <p style={{ fontFamily: fontSans, fontSize: 14, margin: 0 }}>with {coachDisplayName}</p>
                </div>
              </div>
              <div style={{ width: 280, border: line, padding: 20, background: "rgba(26,58,47,0.03)" }}>
                <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>This session only</p>
                <div
                  style={{
                    padding: 14,
                    border: line,
                    background: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontFamily: fontSans, fontSize: 14 }}>
                    {durationMinutes >= 60 ? `${durationMinutes / 60} hr` : `${durationMinutes} min`}
                  </span>
                  <span style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 700, color: color.forest }}>
                    Free
                  </span>
                </div>
                {hourlyRate != null && sessionType === "session" && (
                  <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "12px 0 0" }}>
                    Paid sessions (${hourlyRate}/hr) coming soon — booking is free for now.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "success" && selectedSlot && (
            <div style={{ flex: 1, padding: 32, textAlign: "center" }}>
              <CoachAvatar name={coachDisplayName} photoUrl={coachPhotoUrl} size={72} />
              <p style={{ ...displayTitleStyle(22), margin: "20px 0 8px" }}>You&apos;re all set!</p>
              <p style={{ fontFamily: fontSans, fontSize: 15, color: color.stone, margin: "0 0 8px" }}>
                {formatSlotLabel(selectedSlot.startTime, selectedSlot.endTime)}
              </p>
              <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>
                A calendar invite will arrive at your email. See it on your dashboard under Sessions.
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
            {step === "calendar" && selectedSlot && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  border: "2px solid #1A3A2F",
                  fontFamily: fontSans,
                  fontSize: 13,
                }}
              >
                Selected: {formatSlotLabel(selectedSlot.startTime, selectedSlot.endTime)}
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            )}
            {error && step !== "calendar" && (
              <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b45309", margin: 0 }}>{error}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {step !== "success" && step !== "type" && (
              <ScoutSecondaryBtn
                onClick={() => {
                  if (step === "confirm") setStep("calendar");
                  else if (step === "calendar") setStep("type");
                }}
              >
                Back
              </ScoutSecondaryBtn>
            )}
            {step === "type" && (
              <LelandContinueBtn onClick={() => setStep("calendar")}>Continue</LelandContinueBtn>
            )}
            {step === "calendar" && (
              <LelandContinueBtn disabled={!selectedSlot} onClick={() => setStep("confirm")}>
                Continue
              </LelandContinueBtn>
            )}
            {step === "confirm" && (
              <LelandContinueBtn disabled={submitting} onClick={confirmBooking}>
                {submitting ? "Confirming…" : "Confirm booking"}
              </LelandContinueBtn>
            )}
            {step === "success" && (
              <LelandContinueBtn onClick={onClose}>Done</LelandContinueBtn>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function formatCoachNextAvailable(startSec: number): string {
  return formatNextAvailable(startSec);
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

function LelandContinueBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
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

const navBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: line,
  background: "#fff",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
};

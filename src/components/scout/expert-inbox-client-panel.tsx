"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdminClient } from "@/components/admin/admin-clients-panel";
import { CoachClientSessionNotesPanel } from "@/components/scout/coach-client-session-notes-panel";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import type { CoachClientSummary, HubBooking } from "@/lib/coach-hub";
import { bookingStatusColor, bookingStatusLabel, formatBookingWhen } from "@/lib/booking-display";
import { border, color, fontMono, fontSans, radius, shadow, surface, type as T } from "@/lib/typography";

type SectionId = "sessions" | "client" | "notes" | "history";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
    >
      <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollapsibleCard({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: surface.card,
        border: border.line,
        borderRadius: radius.box,
        boxShadow: shadow.card,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          border: "none",
          background: open ? "rgba(74,139,106,0.06)" : surface.card,
          cursor: "pointer",
          fontFamily: fontSans,
          fontSize: T.bodySm,
          fontWeight: 600,
          color: color.ink,
          textAlign: "left",
        }}
      >
        {title}
        <Chevron open={open} />
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: border.line }}>
          {children}
        </div>
      )}
    </div>
  );
}

function formatDurationMinutes(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function SessionHistoryRow({ booking }: { booking: HubBooking }) {
  const { date, time } = formatBookingWhen(booking.startAt, booking.endAt);
  const statusStyle = bookingStatusColor(booking.status);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderBottom: border.line,
        fontFamily: fontSans,
        fontSize: 13,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontWeight: 600, color: color.ink }}>{booking.title ?? "Coaching session"}</p>
        <p style={{ margin: 0, fontSize: 12, color: color.muted }}>{date}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: color.muted }}>{time}</p>
      </div>
      <span
        style={{
          alignSelf: "flex-start",
          fontFamily: fontMono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          padding: "3px 7px",
          borderRadius: radius.box,
          background: statusStyle.bg,
          color: statusStyle.color,
          whiteSpace: "nowrap",
        }}
      >
        {bookingStatusLabel(booking.status)}
      </span>
    </div>
  );
}

type Props = {
  client: CoachClientSummary;
  clientProfile: AdminClient | null;
  upcoming: HubBooking[];
  past: HubBooking[];
  vouchUrl: string | null;
  onViewClients: () => void;
  onViewClientProfile?: (userId: string) => void;
};

export function ExpertInboxClientPanel({
  client,
  clientProfile,
  upcoming,
  past,
  vouchUrl,
  onViewClients,
  onViewClientProfile,
}: Props) {
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(["sessions"]));

  useEffect(() => {
    setOpenSections(new Set(["sessions"]));
  }, [client.userId, client.email]);

  function toggleSection(id: SectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandSection(id: SectionId) {
    setOpenSections((prev) => new Set(prev).add(id));
  }

  const completedMinutes = past
    .filter((b) => b.status === "CONFIRMED")
    .reduce((sum, b) => sum + (b.durationMinutes ?? 0), 0);

  const displayName = client.name ?? client.email.split("@")[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <CollapsibleCard
        id="sessions"
        title="Sessions"
        open={openSections.has("sessions")}
        onToggle={toggleSection}
      >
        <div style={{ paddingTop: 14 }}>
          <p style={{ margin: "0 0 4px", fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
            Total time completed
          </p>
          <p style={{ margin: "0 0 14px", fontFamily: fontSans, fontSize: 22, fontWeight: 600, color: color.forest }}>
            {formatDurationMinutes(completedMinutes || client.completedCount * 60)}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, fontFamily: fontSans, fontSize: 13, color: color.stone }}>
            <p style={{ margin: 0 }}>{client.sessionCount} session{client.sessionCount === 1 ? "" : "s"} total</p>
            {client.upcomingCount > 0 && <p style={{ margin: 0 }}>{client.upcomingCount} upcoming</p>}
            {client.nextSessionAt && (
              <p style={{ margin: 0, color: color.muted }}>
                Next:{" "}
                {new Date(client.nextSessionAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
          {client.userId ? (
            <ScoutPrimaryBtn type="button" onClick={() => expandSection("notes")} style={{ width: "100%", minHeight: 40 }}>
              Log session notes
            </ScoutPrimaryBtn>
          ) : (
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: color.muted, lineHeight: 1.5 }}>
              Guest bookings only — notes are available once this client has a Kimchi account.
            </p>
          )}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        id="client"
        title="Client info"
        open={openSections.has("client")}
        onToggle={toggleSection}
      >
        <div style={{ paddingTop: 14, fontFamily: fontSans, fontSize: 13, color: color.stone }}>
          <p style={{ margin: "0 0 10px", wordBreak: "break-word" }}>{client.email}</p>
          {clientProfile?.profile?.headline && (
            <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>{clientProfile.profile.headline}</p>
          )}
          {clientProfile?.profile?.targetRoles && clientProfile.profile.targetRoles.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ margin: "0 0 6px", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                Target roles
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {clientProfile.profile.targetRoles.slice(0, 4).map((role) => (
                  <span
                    key={role}
                    style={{
                      fontSize: 12,
                      padding: "4px 8px",
                      border: border.line,
                      borderRadius: radius.box,
                      background: surface.inset,
                    }}
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clientProfile?.profile?.linkedinUrl && (
              <a href={clientProfile.profile.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: color.forest, fontWeight: 600, textDecoration: "none" }}>
                LinkedIn ↗
              </a>
            )}
            {clientProfile?.profile?.resumeUrl && (
              <a href={clientProfile.profile.resumeUrl} target="_blank" rel="noreferrer" style={{ color: color.forest, fontWeight: 600, textDecoration: "none" }}>
                Resume ↗
              </a>
            )}
            {client.userId && onViewClientProfile && (
              <ScoutSecondaryBtn type="button" onClick={() => onViewClientProfile(client.userId!)} style={{ alignSelf: "flex-start" }}>
                View profile
              </ScoutSecondaryBtn>
            )}
          </div>
        </div>
      </CollapsibleCard>

      {client.userId && (
        <CollapsibleCard
          id="notes"
          title="Notes"
          open={openSections.has("notes")}
          onToggle={toggleSection}
        >
          <div style={{ paddingTop: 8 }}>
            <CoachClientSessionNotesPanel clientUserId={client.userId} mode="coach" compact />
          </div>
        </CollapsibleCard>
      )}

      <CollapsibleCard
        id="history"
        title="Session history"
        open={openSections.has("history")}
        onToggle={toggleSection}
      >
        <div style={{ paddingTop: 8 }}>
          {upcoming.length > 0 && (
            <>
              <p style={{ margin: "6px 0 8px", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                Upcoming
              </p>
              {upcoming.map((b) => (
                <SessionHistoryRow key={b.id} booking={b} />
              ))}
            </>
          )}
          {past.length === 0 && upcoming.length === 0 ? (
            <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>No sessions yet.</p>
          ) : (
            past.length > 0 && (
              <>
                <p style={{ margin: upcoming.length ? "14px 0 8px" : "6px 0 8px", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                  Past
                </p>
                {past.slice(0, 8).map((b) => (
                  <SessionHistoryRow key={b.id} booking={b} />
                ))}
              </>
            )
          )}
          <div style={{ marginTop: 14 }}>
            <ScoutSecondaryBtn type="button" onClick={onViewClients}>Open in Clients</ScoutSecondaryBtn>
          </div>
        </div>
      </CollapsibleCard>

      {vouchUrl && (
        <ScoutBox padding={14} style={{ background: "rgba(42,107,74,0.04)" }}>
          <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Request a review</p>
          <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: 12, color: color.muted, lineHeight: 1.45 }}>
            Send your vouch link after a great session.
          </p>
          <Link href="/dashboard/reviews" style={{ textDecoration: "none" }}>
            <ScoutSecondaryBtn type="button">Get vouch link</ScoutSecondaryBtn>
          </Link>
        </ScoutBox>
      )}
    </div>
  );
}

import { formatSessionDateRange } from "@/lib/live-session-display";

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildLiveSessionIcs(session: {
  title: string;
  description: string;
  host: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  legacyNumericId: number | null;
  id: string;
}): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.kimchi.so";
  const routeId = session.legacyNumericId != null ? String(session.legacyNumericId) : session.id;
  const url = `${base.replace(/\/$/, "")}/live/${routeId}`;
  const { date, time } = formatSessionDateRange(session.scheduledStart, session.scheduledEnd);
  const uid = `kimchi-live-${session.id}@kimchi.so`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kimchi//Live Sessions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(session.scheduledStart)}`,
    `DTEND:${formatIcsDate(session.scheduledEnd)}`,
    `SUMMARY:${escapeIcs(session.title)}`,
    `DESCRIPTION:${escapeIcs(`${session.description}\\n\\nWith ${session.host}\\n${date} · ${time}\\n${url}`)}`,
    `URL:${url}`,
    `LOCATION:${escapeIcs("Kimchi Live")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function googleCalendarUrl(session: {
  title: string;
  description: string;
  host: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  legacyNumericId: number | null;
  id: string;
}): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.kimchi.so";
  const routeId = session.legacyNumericId != null ? String(session.legacyNumericId) : session.id;
  const url = `${base.replace(/\/$/, "")}/live/${routeId}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: session.title,
    dates: `${formatIcsDate(session.scheduledStart)}/${formatIcsDate(session.scheduledEnd)}`,
    details: `${session.description}\n\nWith ${session.host}\n${url}`,
    location: "Kimchi Live",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

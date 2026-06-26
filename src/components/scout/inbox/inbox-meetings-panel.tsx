"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";

type MeetingEvent = {
  id: string;
  title: string;
  location: string | null;
  startAt: string | null;
  endAt: string | null;
  startLabel: string;
  participants?: string[];
};

function formatTimeRange(startAt: string | null, endAt: string | null): string {
  if (!startAt) return "";
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(":00", "");
  return `${fmt(start)} – ${fmt(end)}`;
}

function groupByDay(events: MeetingEvent[]): { label: string; events: MeetingEvent[] }[] {
  const map = new Map<string, MeetingEvent[]>();
  for (const ev of events) {
    if (!ev.startAt) continue;
    const day = new Date(ev.startAt).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(ev);
  }
  return [...map.entries()].map(([label, items]) => ({ label, events: items }));
}

type Props = {
  refreshKey?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function InboxMeetingsPanel({ refreshKey, collapsed, onToggleCollapse }: Props) {
  const [events, setEvents] = useState<MeetingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/email/events");
      if (!res.ok) {
        setEvents([]);
        return;
      }
      const data = await res.json();
      setEvents((data.events ?? []).filter((e: MeetingEvent) => e.startAt));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const grouped = useMemo(() => groupByDay(events), [events]);
  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        title="Show meetings"
        style={{
          width: 40,
          border: "none",
          borderLeft: border.line,
          background: surface.page,
          cursor: "pointer",
          color: color.forest,
          fontFamily: fontSans,
          fontSize: 18,
        }}
      >
        📅
      </button>
    );
  }

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: border.line,
        background: surface.inset,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: border.line,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.forest }}>
            Meetings
          </p>
          <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: T.label, color: color.muted }}>{todayLabel}</p>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            style={{ border: "none", background: "none", cursor: "pointer", color: color.muted, fontSize: 16 }}
            aria-label="Hide meetings"
          >
            ×
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {loading && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>Loading calendar…</p>
        )}
        {!loading && grouped.length === 0 && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.5 }}>
            No upcoming meetings on your connected calendar. Ask Kimchi in chat for a summary anytime.
          </p>
        )}
        {grouped.map((group) => (
          <div key={group.label} style={{ marginBottom: 16 }}>
            <p
              style={{
                margin: "0 0 8px",
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 700,
                color: color.muted,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {group.label}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.events.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: surface.card,
                    border: border.line,
                  }}
                >
                  <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.label, color: color.muted }}>
                    {formatTimeRange(ev.startAt, ev.endAt)}
                  </p>
                  <p style={{ margin: "0 0 2px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                    {ev.title}
                  </p>
                  {ev.participants && ev.participants.length > 0 && (
                    <p style={{ margin: "0 0 2px", fontFamily: fontSans, fontSize: T.label, color: color.muted }}>
                      {ev.participants.join(", ")}
                    </p>
                  )}
                  {ev.location && (
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.label, color: color.muted }}>{ev.location}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

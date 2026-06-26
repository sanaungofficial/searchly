"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox } from "@/components/scout/scout-box";
import { border, color, fontSans } from "@/lib/typography";

type Props = {
  /** Omit when the logged-in expert views their own inbox (e.g. centralized /inbox). */
  coachId?: string;
  embedded?: boolean;
};

type MessageRow = {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  dateLabel: string;
  unread: boolean;
};

export function CoachInboxPanel({ coachId }: Props) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = coachId ? `coachId=${encodeURIComponent(coachId)}&` : "";
      const res = await fetch(`/api/coach/email/messages?${qs}limit=25`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load inbox");
      setMessages(data.messages ?? []);
      setEmail(data.email ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inbox");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>Loading inbox…</p>;
  }

  if (error) {
    return (
      <ScoutBox padding={20}>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.muted, lineHeight: 1.6 }}>
          {error}
        </p>
        <p style={{ margin: "12px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
          Connect calendar with email sync enabled from the Availability tab to view expert mail here.
        </p>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 16, fontWeight: 600, color: color.forest }}>
          Expert inbox
        </p>
        {email && (
          <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>{email}</p>
        )}
      </div>

      {messages.length === 0 ? (
        <ScoutBox padding={20}>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.muted }}>No recent messages.</p>
        </ScoutBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                background: surfaceCard(),
                border: border.line,
                padding: "14px 16px",
              }}
            >
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, fontWeight: m.unread ? 600 : 500, color: color.stone }}>
                {m.subject}
              </p>
              <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                {m.from} · {m.dateLabel}
              </p>
              {m.snippet && (
                <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
                  {m.snippet}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function surfaceCard() {
  return "#FFFDF9";
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import { SenderAvatar } from "./sender-avatar";
import { buildSenderAvatarUrls } from "@/lib/email-sender-display";

type ContactRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  savedToNylas: boolean;
  activityCount: number;
  lastActivity: { subject: string | null; occurredAt: string | null; direction: string } | null;
  linkedJobs: { id: string; company: string; role: string; stage: string }[];
};

type Props = {
  scopePath: (path: string) => string;
  onSelectContact: (contactId: string) => void;
};

export function InboxContactsPanel({ scopePath, onSelectContact }: Props) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await fetch(scopePath(`/api/user/inbox/contacts${params}`));
      if (!res.ok) {
        setContacts([]);
        return;
      }
      const data = await res.json();
      setContacts(data.contacts ?? []);
    } finally {
      setLoading(false);
    }
  }, [scopePath, search]);

  useEffect(() => {
    const t = setTimeout(() => {
      load().catch(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: surface.card }}>
      <div style={{ padding: "12px 16px", borderBottom: "var(--scout-border)" }}>
        <input
          type="search"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 12px",
            border: "var(--scout-border)",
            borderRadius: 8,
            fontFamily: fontSans,
            fontSize: T.bodySm,
          }}
        />
        <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: 11, color: color.muted }}>
          Your CRM contacts — from imports, mail sync, and manual adds.
        </p>
      </div>

      {loading && (
        <p style={{ padding: 16, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>Loading…</p>
      )}
      {!loading && contacts.length === 0 && (
        <p style={{ padding: 16, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
          No contacts yet. Import a client packet, open a message and save a contact, or link someone to an opportunity.
        </p>
      )}

      {contacts.map((c) => {
        const avatar = buildSenderAvatarUrls(c.name ?? c.email, c.email);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectContact(c.id)}
            style={{
              display: "flex",
              gap: 12,
              width: "100%",
              textAlign: "left",
              padding: "14px 16px",
              border: "none",
              borderBottom: "var(--scout-border)",
              alignItems: "flex-start",
              background: "transparent",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(42,107,74,0.04)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <SenderAvatar
              primary={avatar.primary}
              fallback={avatar.fallback}
              initials={avatar.initials}
              displayName={avatar.displayName}
              size={36}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink }}>
                {c.name ?? c.email}
              </p>
              <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 11, color: color.muted }}>
                {c.email}
                {c.company ? ` · ${c.company}` : ""}
              </p>
              {c.linkedJobs.length > 0 && (
                <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 11, color: color.forest }}>
                  {c.linkedJobs.map((j) => `${j.role} @ ${j.company}`).join(" · ")}
                </p>
              )}
              {c.lastActivity?.subject && (
                <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 11, color: color.muted }}>
                  Last: {c.lastActivity.subject}
                  {c.activityCount > 1 ? ` (+${c.activityCount - 1} more)` : ""}
                </p>
              )}
            </div>
            {c.savedToNylas && (
              <span
                style={{
                  fontFamily: fontSans,
                  fontSize: 10,
                  fontWeight: 700,
                  color: color.forest,
                  background: "rgba(42,107,74,0.1)",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                Saved
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

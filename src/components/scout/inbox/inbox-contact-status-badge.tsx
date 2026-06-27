"use client";

import {
  INBOX_CONTACT_STATUSES,
  contactStatusMeta,
  type InboxContactStatus,
} from "@/lib/inbox-crm/contact-status";
import { fontSans } from "@/lib/typography";

export function InboxContactStatusBadge({ status }: { status: string | null | undefined }) {
  const meta = contactStatusMeta(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px 3px 8px",
        borderRadius: 6,
        background: meta.bg,
        color: meta.color,
        fontFamily: fontSans,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: meta.dot,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 13, lineHeight: 1 }}>{meta.emoji}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{meta.label}</span>
    </span>
  );
}

export function InboxContactStatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (status: InboxContactStatus) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? "new"}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as InboxContactStatus)}
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "#fff",
        fontFamily: fontSans,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        maxWidth: "100%",
      }}
    >
      {INBOX_CONTACT_STATUSES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.emoji} {s.label}
        </option>
      ))}
    </select>
  );
}

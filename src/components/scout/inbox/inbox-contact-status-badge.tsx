"use client";

import {
  INBOX_CONTACT_STATUSES,
  contactStatusMeta,
  type InboxContactStatus,
} from "@/lib/inbox-crm/contact-status";
import { fontSans, type as T } from "@/lib/typography";

export function InboxContactStatusBadge({ status, size = "md" }: { status: string | null | undefined; size?: "md" | "lg" }) {
  const meta = contactStatusMeta(status);
  const fontSize = size === "lg" ? T.bodySm : T.caption;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: size === "lg" ? "5px 12px 5px 10px" : "4px 10px 4px 8px",
        borderRadius: 8,
        background: meta.bg,
        color: meta.color,
        fontFamily: fontSans,
        fontSize,
        fontWeight: 600,
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}
    >
      <span
        style={{
          width: size === "lg" ? 9 : 8,
          height: size === "lg" ? 9 : 8,
          borderRadius: "50%",
          background: meta.dot,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: fontSize + 1, lineHeight: 1 }}>{meta.emoji}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{meta.label}</span>
    </span>
  );
}

/** Close-style status control — pill appearance, opens native select overlay. */
export function InboxContactStatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined;
  onChange: (status: InboxContactStatus) => void;
  disabled?: boolean;
}) {
  const meta = contactStatusMeta(value);
  return (
    <div style={{ position: "relative", display: "inline-flex", maxWidth: "100%" }}>
      <InboxContactStatusBadge status={value} size="lg" />
      <select
        value={value ?? "new"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as InboxContactStatus)}
        aria-label="Contact status"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          width: "100%",
          height: "100%",
        }}
      >
        {INBOX_CONTACT_STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.emoji} {s.label}
          </option>
        ))}
      </select>
      {!disabled && (
        <span
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 10,
            color: meta.color,
            pointerEvents: "none",
          }}
        >
          ▾
        </span>
      )}
    </div>
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
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "#fff",
        fontFamily: fontSans,
        fontSize: T.bodySm,
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

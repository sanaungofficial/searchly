"use client";

import { signalStatusLabel, userTagStyle, type InboxUserTag } from "@/lib/email-sender-display";

type Tone = "green" | "amber" | "red" | "blue" | "neutral";

const toneStyles: Record<Tone, { bg: string; color: string; border: string }> = {
  green: { bg: "rgba(42,107,74,0.12)", color: "#1C3A2F", border: "rgba(42,107,74,0.22)" },
  amber: { bg: "rgba(234,179,8,0.14)", color: "#92400E", border: "rgba(234,179,8,0.28)" },
  red: { bg: "rgba(196,87,74,0.12)", color: "#9B3D32", border: "rgba(196,87,74,0.22)" },
  blue: { bg: "rgba(59,130,246,0.12)", color: "#1D4ED8", border: "rgba(59,130,246,0.22)" },
  neutral: { bg: "rgba(0,0,0,0.05)", color: "#555", border: "rgba(0,0,0,0.08)" },
};

function Pill({ label, tone }: { label: string; tone: Tone }) {
  const s = toneStyles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

type Props = {
  userTag?: InboxUserTag | null;
  signal?: string | null;
  compact?: boolean;
};

export function InboxStatusPills({ userTag, signal, compact }: Props) {
  const pills: { label: string; tone: Tone }[] = [];

  if (userTag) {
    pills.push(userTagStyle(userTag));
  } else if (signal && signal !== "OTHER") {
    pills.push(signalStatusLabel(signal));
  }

  if (pills.length === 0) return null;

  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: compact ? 4 : 6 }}>
      {pills.map((p) => (
        <Pill key={p.label} label={p.label} tone={p.tone} />
      ))}
    </span>
  );
}

export function InboxStatusDropdown({
  value,
  onChange,
  disabled,
}: {
  value: InboxUserTag | null;
  onChange: (tag: InboxUserTag | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? (e.target.value as InboxUserTag) : null)}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.1)",
        background: "#fff",
        fontFamily: "var(--font-ui)",
        fontSize: 12,
        fontWeight: 600,
        color: "#1C3A2F",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <option value="">Set status…</option>
      <option value="needs_follow_up">↩ Follow up</option>
      <option value="potential">✦ Potential</option>
      <option value="waiting">⏳ Waiting</option>
      <option value="answered">✓ Answered</option>
    </select>
  );
}

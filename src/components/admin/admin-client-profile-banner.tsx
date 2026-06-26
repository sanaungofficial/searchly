"use client";

import { color, fontMono, fontSans } from "@/lib/typography";

type Props = {
  name?: string | null;
  email?: string | null;
  onBack: () => void;
};

export function AdminClientProfileBanner({ name, email, onBack }: Props) {
  const label = name ?? email?.split("@")[0] ?? "client";

  return (
    <div
      style={{
        background: "#2C4A6E",
        color: color.gold,
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        borderBottom: "1px solid rgba(232,213,163,0.2)",
        flexShrink: 0,
        zIndex: 30,
        position: "relative",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontFamily: fontSans }}>
        Viewing as admin for <strong style={{ fontWeight: 600 }}>{label}</strong>
        {email ? (
          <span style={{ opacity: 0.75, fontFamily: fontMono, marginLeft: 8, fontSize: 12 }}>{email}</span>
        ) : null}
      </p>
      <button
        type="button"
        onClick={onBack}
        style={{
          padding: "6px 12px",
          background: "transparent",
          border: "1px solid rgba(232,213,163,0.45)",
          color: color.gold,
          borderRadius: "var(--scout-radius)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: fontSans,
        }}
      >
        Back to clients
      </button>
    </div>
  );
}

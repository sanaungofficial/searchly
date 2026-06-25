"use client";

import { useState } from "react";

export function CoachAvatar({
  name,
  photoUrl,
  size,
  rounded,
}: {
  name: string;
  photoUrl: string | null;
  size: number;
  /** Square with slight radius (Leland-style cards). Default: circle for small avatars, square for large. */
  rounded?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const radius = rounded ? 10 : size >= 56 ? 0 : "50%";

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0 }}
      />
    );
  }

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "#1A3A2F",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontSize: size * 0.33, fontWeight: 600, color: "#E8D5A3" }}>
        {initials}
      </span>
    </div>
  );
}

export function CoachStarRating({ rating, count }: { rating: number | null; count?: number }) {
  if (rating == null) return null;
  return (
    <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A1A1A", display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: "#E8A317", fontSize: 15, lineHeight: 1 }} aria-hidden>★</span>
      <span style={{ fontWeight: 700 }}>{rating.toFixed(1)}</span>
      {count != null && count > 0 && (
        <span style={{ color: "var(--scout-muted)", fontWeight: 400, fontSize: 13 }}>({count})</span>
      )}
    </span>
  );
}

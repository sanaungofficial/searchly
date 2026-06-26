"use client";

import { useEffect, useState } from "react";

type Props = {
  primary: string | null;
  fallback: string | null;
  initials: string;
  displayName: string;
  size?: number;
};

const palette = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#10b981", "#0ea5e9", "#f43f5e", "#84cc16"];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function SenderAvatar({ primary, fallback, initials, displayName, size = 36 }: Props) {
  const [stage, setStage] = useState<"primary" | "fallback" | "initials">("primary");

  useEffect(() => {
    setStage(primary ? "primary" : fallback ? "fallback" : "initials");
  }, [primary, fallback]);

  const bg = colorFor(displayName);
  const br = size <= 32 ? 8 : 10;

  if (stage !== "initials" && (stage === "primary" ? primary : fallback)) {
    const src = stage === "primary" ? primary! : fallback!;
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: br,
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.06)",
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={src}
          alt=""
          width={size - 6}
          height={size - 6}
          style={{ objectFit: "contain", borderRadius: 4 }}
          onError={() => setStage((s) => (s === "primary" && fallback ? "fallback" : "initials"))}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: br,
        background: bg,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontSize: size <= 32 ? 11 : 13, fontWeight: 700, color: "#fff" }}>
        {initials}
      </span>
    </div>
  );
}

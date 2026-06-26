"use client";

import { clearClientSessionCaches, setActingUserScope } from "@/lib/client-session";
import { useState } from "react";
import { color, fontMono, fontSans } from "@/lib/typography";

export type ImpersonationState = {
  active: boolean;
  name?: string | null;
  email?: string;
};

export function ImpersonationBanner({ state }: { state: ImpersonationState }) {
  const [exiting, setExiting] = useState(false);

  if (!state.active) return null;

  const label = state.name ?? state.email?.split("@")[0] ?? "client";

  async function exitImpersonation() {
    setExiting(true);
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      clearClientSessionCaches();
      setActingUserScope(null);
      window.location.href = "/dashboard/clients";
    } catch {
      setExiting(false);
    }
  }

  return (
    <div
      style={{
        background: "#1A3A2F",
        color: color.gold,
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        borderBottom: "1px solid rgba(232,213,163,0.2)",
        zIndex: 20,
        position: "relative",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontFamily: fontSans }}>
        Viewing as <strong style={{ fontWeight: 600 }}>{label}</strong>
        {state.email ? (
          <span style={{ opacity: 0.75, fontFamily: fontMono, marginLeft: 8, fontSize: 12 }}>{state.email}</span>
        ) : null}
      </p>
      <button
        onClick={exitImpersonation}
        disabled={exiting}
        style={{
          padding: "6px 12px",
          background: "transparent",
          border: "1px solid rgba(232,213,163,0.45)",
          color: color.gold,
          borderRadius: "var(--scout-radius)",
          fontSize: 12,
          fontWeight: 600,
          cursor: exiting ? "default" : "pointer",
          fontFamily: fontSans,
        }}
      >
        {exiting ? "Exiting…" : "Exit client view"}
      </button>
    </div>
  );
}

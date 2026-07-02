"use client";

import { color, fontSans, surface, type as T } from "@/lib/typography";

export type InboxTab = "primary" | "sent" | string;

type Props = {
  active: InboxTab;
  primaryCount?: number;
  onSelect: (tab: InboxTab) => void;
  extraFolders?: { id: string; name: string }[];
};

const TAB_STYLE = (active: boolean) => ({
  padding: "12px 16px",
  minHeight: 44,
  border: "none",
  borderBottom: active ? `2px solid ${color.forest}` : "2px solid transparent",
  background: "transparent",
  fontFamily: fontSans,
  fontSize: active ? T.body : T.bodySm,
  fontWeight: active ? 600 : 500,
  color: active ? color.forest : color.muted,
  cursor: "pointer" as const,
  whiteSpace: "nowrap" as const,
  flexShrink: 0,
});

/** Mail folder sub-tabs within Inbox (Primary, Sent, etc.). */
export function InboxTopTabs({ active, primaryCount, onSelect, extraFolders = [] }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 4,
        padding: "0 4px",
        borderBottom: "var(--scout-border)",
        background: surface.page,
        overflowX: "auto",
        flexShrink: 0,
      }}
    >
      <button type="button" style={TAB_STYLE(active === "primary")} onClick={() => onSelect("primary")}>
        Primary{primaryCount ? ` (${primaryCount})` : ""}
      </button>
      <button type="button" style={TAB_STYLE(active === "sent")} onClick={() => onSelect("sent")}>
        Sent
      </button>
      {extraFolders.map((f) => (
        <button key={f.id} type="button" style={TAB_STYLE(active === f.id)} onClick={() => onSelect(f.id)}>
          {f.name}
        </button>
      ))}
    </div>
  );
}

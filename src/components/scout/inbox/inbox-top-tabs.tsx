"use client";

import { color, fontSans, border, type as T } from "@/lib/typography";

export type InboxTab = "primary" | "sent" | "contacts";

type Props = {
  active: InboxTab | string;
  primaryCount?: number;
  onSelect: (tab: InboxTab | string) => void;
  extraFolders?: { id: string; name: string }[];
  mailConnected?: boolean;
};

const TAB_STYLE = (active: boolean) => ({
  padding: "10px 14px",
  border: "none",
  borderBottom: active ? `2px solid ${color.forest}` : "2px solid transparent",
  background: "transparent",
  fontFamily: fontSans,
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  color: active ? color.forest : color.muted,
  cursor: "pointer" as const,
  whiteSpace: "nowrap" as const,
});

export function InboxTopTabs({ active, primaryCount, onSelect, extraFolders = [], mailConnected = true }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "0 12px",
        borderBottom: border.line,
        background: "#fff",
        overflowX: "auto",
      }}
    >
      <button type="button" style={TAB_STYLE(active === "contacts")} onClick={() => onSelect("contacts")}>
        Contacts
      </button>
      {mailConnected && (
        <>
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
        </>
      )}
    </div>
  );
}

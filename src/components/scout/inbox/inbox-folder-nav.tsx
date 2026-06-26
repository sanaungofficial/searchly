"use client";

import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import type { Folder } from "./inbox-types";

type Props = {
  folders: Folder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function InboxFolderNav({ folders, selectedId, onSelect }: Props) {
  return (
    <nav
      style={{
        width: 196,
        flexShrink: 0,
        borderRight: border.line,
        background: surface.page,
        padding: "12px 10px",
        overflowY: "auto",
      }}
    >
      <p
        style={{
          margin: "0 0 10px 8px",
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: color.muted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        Mail
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {folders.map((f) => {
          const active = f.id === selectedId;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelect(f.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                width: "100%",
                padding: "8px 10px",
                border: "none",
                borderRadius: 8,
                background: active ? "rgba(26,58,47,0.08)" : "transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  fontWeight: active ? 700 : 500,
                  color: active ? color.forest : color.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {f.name}
              </span>
              {f.unread_count ? (
                <span
                  style={{
                    fontFamily: fontSans,
                    fontSize: 10,
                    fontWeight: 700,
                    color: color.forest,
                    background: "rgba(42,107,74,0.12)",
                    borderRadius: 999,
                    padding: "1px 6px",
                    flexShrink: 0,
                  }}
                >
                  {f.unread_count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

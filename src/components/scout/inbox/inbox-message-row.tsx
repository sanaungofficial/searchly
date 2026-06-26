"use client";

import { color, fontMono, fontSans, type as T } from "@/lib/typography";
import { InboxStatusPills } from "./inbox-status-pill";
import { inboxRowStyle } from "./inbox-row-styles";
import { SenderAvatar } from "./sender-avatar";
import type { MessageSummary } from "./inbox-types";

type Props = {
  msg: MessageSummary;
  expanded: boolean;
  hovered: boolean;
  isLastOpened: boolean;
  isFocusUnread: boolean;
  onToggle: () => void;
  onHover: (hovering: boolean) => void;
};

export function InboxMessageRow({
  msg,
  expanded,
  hovered,
  isLastOpened,
  isFocusUnread,
  onToggle,
  onHover,
}: Props) {
  const name = msg.fromName ?? msg.from;
  const avatar = msg.avatar ?? { primary: null, fallback: null, initials: name.slice(0, 2).toUpperCase() };
  const rowStyle = inboxRowStyle({ expanded, hovered, isLastOpened, isFocusUnread, unread: msg.unread });

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{
        display: "flex",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "14px 16px",
        border: "none",
        cursor: "pointer",
        ...rowStyle,
      }}
    >
      <SenderAvatar
        primary={avatar.primary}
        fallback={avatar.fallback}
        initials={avatar.initials}
        displayName={name}
        size={40}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span
            style={{
              flex: 1,
              fontFamily: fontSans,
              fontSize: T.bodySm,
              fontWeight: msg.unread ? 700 : 600,
              color: color.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
          <span style={{ fontFamily: fontMono, fontSize: 10, color: color.muted, flexShrink: 0 }}>{msg.dateLabel}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: fontSans,
              fontSize: T.caption,
              fontWeight: 600,
              color: msg.unread ? color.forest : color.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {msg.starred ? "★ " : ""}
            {msg.subject}
          </span>
          <InboxStatusPills userTag={msg.activity?.userTag} signal={msg.activity?.signal} compact />
        </div>
        {!expanded && (
          <p
            style={{
              margin: 0,
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {msg.snippet}
          </p>
        )}
      </div>
    </button>
  );
}

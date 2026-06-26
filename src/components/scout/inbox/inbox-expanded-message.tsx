"use client";

import { useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { InboxStatusDropdown, InboxStatusPills } from "./inbox-status-pill";
import { SenderAvatar } from "./sender-avatar";
import type { MessageDetail } from "./inbox-types";

type Props = {
  detail: MessageDetail;
  tagSaving: boolean;
  onClose: () => void;
  onReply: () => void;
  onPatch: (patch: { unread?: boolean; starred?: boolean; archive?: boolean }) => void;
  onTagChange: (tag: InboxUserTag | null) => void;
  onOpenThreadMessage: (id: string) => void;
  scopePath?: (path: string) => string;
};

export function InboxExpandedMessage({
  detail,
  tagSaving,
  onClose,
  onReply,
  onPatch,
  onTagChange,
  onOpenThreadMessage,
  scopePath = (path) => path,
}: Props) {
  const [showThread, setShowThread] = useState(true);

  return (
    <div
      style={{
        padding: "16px 16px 20px 68px",
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <InboxStatusDropdown
            value={detail.activity?.userTag ?? null}
            disabled={tagSaving}
            onChange={onTagChange}
          />
          <span style={{ marginLeft: 8 }}>
            <InboxStatusPills
              userTag={detail.activity?.userTag}
              category={detail.activity?.category}
              signal={detail.activity?.signal}
            />
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close message"
          style={{
            border: "none",
            background: "rgba(0,0,0,0.04)",
            borderRadius: 8,
            width: 32,
            height: 32,
            cursor: "pointer",
            color: color.muted,
            fontSize: 16,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <ScoutPrimaryBtn onClick={onReply}>Reply</ScoutPrimaryBtn>
        <ScoutSecondaryBtn onClick={() => onPatch({ unread: !detail.unread })}>
          {detail.unread ? "Mark read" : "Mark unread"}
        </ScoutSecondaryBtn>
        <ScoutSecondaryBtn onClick={() => onPatch({ starred: !detail.starred })}>
          {detail.starred ? "Unstar" : "Star"}
        </ScoutSecondaryBtn>
        <ScoutSecondaryBtn onClick={() => onPatch({ archive: true })}>Archive</ScoutSecondaryBtn>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
        <SenderAvatar
          primary={detail.avatar?.primary ?? null}
          fallback={detail.avatar?.fallback ?? null}
          initials={detail.avatar?.initials ?? detail.fromName?.slice(0, 2) ?? "?"}
          displayName={detail.fromName ?? detail.from}
          size={36}
        />
        <div>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink }}>
            {detail.fromName ?? detail.from}
          </p>
          <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
            {detail.dateLabel}
          </p>
        </div>
      </div>

      <h3 style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 600, color: color.forest, margin: "0 0 8px" }}>
        {detail.subject}
      </h3>
      {detail.to && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>To: {detail.to}</p>
      )}
      {detail.cc && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px" }}>Cc: {detail.cc}</p>
      )}

      {detail.attachments.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {detail.attachments.map((a) => (
              <a
                key={a.id}
                href={scopePath(`/api/user/email/messages/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(a.id)}`)}
                style={{
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.forest,
                  padding: "6px 10px",
                  border: border.line,
                  borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                {a.filename}
              </a>
            ))}
          </div>
        </div>
      )}

      {detail.thread.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowThread((v) => !v)}
            style={{
              border: "none",
              background: "none",
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.forest,
              cursor: "pointer",
              padding: 0,
              fontWeight: 600,
            }}
          >
            {showThread ? "Hide" : "Show"} thread ({detail.thread.length})
          </button>
          {showThread && (
            <div style={{ marginTop: 8, border: border.line, borderRadius: 10, overflow: "hidden", background: surface.page }}>
              {detail.thread.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenThreadMessage(t.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    borderBottom: border.line,
                    background: t.id === detail.id ? "rgba(26,58,47,0.06)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.ink }}>
                    {t.fromName ?? t.from}
                  </span>
                  <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}> — {t.subject}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {detail.bodyHtml ? (
        <div
          style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.65 }}
          dangerouslySetInnerHTML={{ __html: detail.bodyHtml }}
        />
      ) : (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: fontSans,
            fontSize: T.bodySm,
            color: color.ink,
            lineHeight: 1.65,
            margin: 0,
          }}
        >
          {detail.bodyText}
        </pre>
      )}
    </div>
  );
}

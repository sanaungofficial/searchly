"use client";

import { useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "../scout-box";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { InboxStatusDropdown, InboxStatusPills } from "./inbox-status-pill";
import { SenderAvatar } from "./sender-avatar";
import { InboxContactBar } from "./inbox-contact-bar";
import type { ContactCardData, MessageDetail } from "./inbox-types";

type Props = {
  detail: MessageDetail;
  tagSaving: boolean;
  jobLinkSaving?: boolean;
  saveContactSaving?: boolean;
  onClose: () => void;
  onReply: () => void;
  onPatch: (patch: { unread?: boolean; starred?: boolean; archive?: boolean }) => void;
  onTagChange: (tag: InboxUserTag | null) => void;
  onLinkJob: (jobId: string | null) => void;
  onCreateAndLink: (company: string, role: string) => void;
  onSaveContact: () => void;
  onOpenThreadMessage: (id: string) => void;
  scopePath?: (path: string) => string;
};

export function InboxExpandedMessage({
  detail,
  tagSaving,
  jobLinkSaving = false,
  saveContactSaving = false,
  onClose,
  onReply,
  onPatch,
  onTagChange,
  onLinkJob,
  onCreateAndLink,
  onSaveContact,
  onOpenThreadMessage,
  scopePath = (path) => path,
}: Props) {
  const [showThread, setShowThread] = useState(false);
  const displayName = detail.fromName ?? detail.from;
  const linkedJob = detail.activity?.job;
  const linkedJobLabel = linkedJob ? `${linkedJob.role} @ ${linkedJob.company}` : null;
  const contactEmail =
    detail.contactCard?.contact?.email ??
    detail.fromEmail ??
    detail.from.replace(/^.*<([^>]+)>.*$/, "$1").trim();

  return (
    <div
      style={{
        padding: "12px 16px 16px 68px",
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
        <SenderAvatar
          primary={detail.avatar?.primary ?? null}
          fallback={detail.avatar?.fallback ?? null}
          initials={detail.avatar?.initials ?? displayName.slice(0, 2).toUpperCase()}
          displayName={displayName}
          size={40}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink }}>
                {displayName}
              </p>
              <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 11, color: color.muted }}>
                {contactEmail}
                {detail.contactCard?.contact?.company ? ` · ${detail.contactCard.contact.company}` : ""}
              </p>
            </div>
            <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, flexShrink: 0 }}>
              {detail.dateLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close message"
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: color.muted,
                fontSize: 18,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
            <InboxStatusDropdown value={detail.activity?.userTag ?? null} disabled={tagSaving} onChange={onTagChange} />
            <InboxStatusPills
              userTag={detail.activity?.userTag}
              category={detail.activity?.category}
              signal={detail.activity?.signal}
            />
          </div>
        </div>
      </div>

      <InboxContactBar
        contactCard={(detail.contactCard as ContactCardData | null) ?? null}
        subject={detail.subject}
        linkedJobId={linkedJob?.id ?? null}
        linkedJobLabel={linkedJobLabel}
        saving={jobLinkSaving}
        saveContactSaving={saveContactSaving}
        scopePath={scopePath}
        onLinkJob={onLinkJob}
        onCreateAndLink={onCreateAndLink}
        onSaveContact={onSaveContact}
      />

      <h3
        style={{
          fontFamily: fontSans,
          fontSize: 16,
          fontWeight: 600,
          color: color.forest,
          margin: "0 0 6px",
          lineHeight: 1.35,
        }}
      >
        {detail.subject}
      </h3>
      {detail.to && (
        <p style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, margin: "0 0 10px" }}>To: {detail.to}</p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <ScoutPrimaryBtn onClick={onReply} style={{ padding: "7px 14px", fontSize: 12 }}>
          Reply
        </ScoutPrimaryBtn>
        <ScoutSecondaryBtn onClick={() => onPatch({ unread: !detail.unread })} style={{ padding: "7px 12px", fontSize: 12 }}>
          {detail.unread ? "Mark read" : "Mark unread"}
        </ScoutSecondaryBtn>
        <ScoutSecondaryBtn onClick={() => onPatch({ starred: !detail.starred })} style={{ padding: "7px 12px", fontSize: 12 }}>
          {detail.starred ? "Unstar" : "Star"}
        </ScoutSecondaryBtn>
        <ScoutSecondaryBtn onClick={() => onPatch({ archive: true })} style={{ padding: "7px 12px", fontSize: 12 }}>
          Archive
        </ScoutSecondaryBtn>
      </div>

      {detail.attachments.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {detail.attachments.map((a) => (
              <a
                key={a.id}
                href={scopePath(`/api/user/email/messages/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(a.id)}`)}
                style={{
                  fontFamily: fontSans,
                  fontSize: 11,
                  color: color.forest,
                  padding: "5px 8px",
                  border: border.line,
                  borderRadius: 6,
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
        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => setShowThread((v) => !v)}
            style={{
              border: "none",
              background: "none",
              fontFamily: fontSans,
              fontSize: 11,
              color: color.forest,
              cursor: "pointer",
              padding: 0,
              fontWeight: 600,
            }}
          >
            {showThread ? "Hide" : "Show"} thread ({detail.thread.length})
          </button>
          {showThread && (
            <div style={{ marginTop: 6, border: border.line, borderRadius: 8, overflow: "hidden", background: surface.page }}>
              {detail.thread.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenThreadMessage(t.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    borderBottom: border.line,
                    background: t.id === detail.id ? "rgba(26,58,47,0.06)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, color: color.ink }}>
                    {t.fromName ?? t.from}
                  </span>
                  <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted }}> — {t.subject}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {detail.bodyHtml ? (
        <div
          style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: detail.bodyHtml }}
        />
      ) : (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: fontSans,
            fontSize: T.bodySm,
            color: color.ink,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {detail.bodyText}
        </pre>
      )}
    </div>
  );
}

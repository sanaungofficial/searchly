"use client";

import { useMemo, useState } from "react";
import { color, fontSans, border, surface, type as T } from "@/lib/typography";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { InboxStatusDropdown } from "./inbox-status-pill";
import { InboxLinkOpportunityModal } from "./inbox-link-opportunity-modal";
import type { MessageDetail } from "./inbox-types";

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
  const [showOlder, setShowOlder] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const displayName = detail.fromName ?? detail.from;
  const contactEmail =
    detail.contactCard?.contact?.email ??
    detail.fromEmail ??
    detail.from.replace(/^.*<([^>]+)>.*$/, "$1").trim();
  const saved = detail.contactCard?.contact?.savedToNylas;
  const linkedJob = detail.activity?.job;

  const olderThread = useMemo(
    () => detail.thread.filter((t) => t.id !== detail.id),
    [detail.thread, detail.id],
  );

  const btnStyle = {
    padding: "5px 10px",
    borderRadius: 6,
    border: border.line,
    background: "#fff",
    fontFamily: fontSans,
    fontSize: 11,
    fontWeight: 600 as const,
    color: color.ink,
    cursor: "pointer" as const,
  };

  return (
    <div
      style={{
        padding: "14px 20px 18px",
        background: "#fff",
        borderBottom: border.line,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      {/* Subject + close — FlowCRM style */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <h3
          style={{
            flex: 1,
            margin: 0,
            fontFamily: fontSans,
            fontSize: 16,
            fontWeight: 700,
            color: color.ink,
            lineHeight: 1.35,
          }}
        >
          {detail.subject}
        </h3>
        <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, flexShrink: 0, paddingTop: 2 }}>
          {detail.dateLabel}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{ border: "none", background: "none", cursor: "pointer", color: color.muted, fontSize: 18, lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Name + status + actions — one row, no avatar repeat */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 700, color: color.forest }}>{displayName}</span>
        <InboxStatusDropdown value={detail.activity?.userTag ?? null} disabled={tagSaving} onChange={onTagChange} />
        <button type="button" style={btnStyle} disabled={jobLinkSaving} onClick={() => setLinkOpen(true)}>
          {linkedJob ? `${linkedJob.role} @ ${linkedJob.company}` : "Link opportunity"}
        </button>
        {!saved && (
          <button
            type="button"
            style={{ ...btnStyle, color: color.forest }}
            disabled={saveContactSaving}
            onClick={onSaveContact}
          >
            {saveContactSaving ? "Saving…" : "Save contact"}
          </button>
        )}
        {saved && (
          <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted }}>Saved to contacts</span>
        )}
      </div>

      {/* From / To + mail actions */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: border.line,
        }}
      >
        <div style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, lineHeight: 1.5 }}>
          <div>From: {detail.from || contactEmail}</div>
          {detail.to && <div>To: {detail.to}</div>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button type="button" style={btnStyle} onClick={onReply}>
            Reply
          </button>
          <button type="button" style={btnStyle} onClick={() => onPatch({ unread: !detail.unread })}>
            {detail.unread ? "Mark read" : "Mark unread"}
          </button>
          <button type="button" style={btnStyle} onClick={() => onPatch({ archive: true })}>
            Archive
          </button>
        </div>
      </div>

      {detail.attachments.length > 0 && (
        <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {detail.attachments.map((a) => (
            <a
              key={a.id}
              href={scopePath(`/api/user/email/messages/${encodeURIComponent(detail.id)}/attachments/${encodeURIComponent(a.id)}`)}
              style={{
                fontFamily: fontSans,
                fontSize: 11,
                color: color.forest,
                padding: "4px 8px",
                border: border.line,
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              {a.filename}
            </a>
          ))}
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

      {olderThread.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: border.line }}>
          <button
            type="button"
            onClick={() => setShowOlder((v) => !v)}
            style={{
              border: "none",
              background: "none",
              fontFamily: fontSans,
              fontSize: 12,
              color: color.muted,
              cursor: "pointer",
              padding: 0,
            }}
          >
            {showOlder ? "▲ Hide" : "▼"} {olderThread.length} older message{olderThread.length === 1 ? "" : "s"}
          </button>
          {showOlder && (
            <div style={{ marginTop: 8, border: border.line, borderRadius: 8, overflow: "hidden", background: surface.page }}>
              {olderThread.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenThreadMessage(t.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    border: "none",
                    borderBottom: border.line,
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, color: color.ink }}>
                    {t.fromName ?? t.from}
                  </span>
                  <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted }}> — {t.snippet || t.subject}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <InboxLinkOpportunityModal
        open={linkOpen}
        subject={detail.subject}
        linkedJobId={linkedJob?.id ?? null}
        saving={jobLinkSaving}
        scopePath={scopePath}
        onClose={() => setLinkOpen(false)}
        onLink={(jobId) => {
          onLinkJob(jobId);
          setLinkOpen(false);
        }}
        onCreateAndLink={(company, role) => {
          onCreateAndLink(company, role);
          setLinkOpen(false);
        }}
        onUnlink={() => {
          onLinkJob(null);
          setLinkOpen(false);
        }}
      />
    </div>
  );
}

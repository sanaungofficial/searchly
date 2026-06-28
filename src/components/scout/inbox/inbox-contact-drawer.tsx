"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import type { InboxUserTag } from "@/lib/email-sender-display";
import { pipelineJobUrl } from "@/lib/workspace-urls";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";
import { InboxLinkOpportunityModal } from "./inbox-link-opportunity-modal";
import { InboxContactStatusPicker } from "./inbox-contact-status-badge";
import type { InboxContactStatus } from "@/lib/inbox-crm/contact-status";
import { InboxStatusPills } from "./inbox-status-pill";
import { SenderAvatar } from "./sender-avatar";
import { buildSenderAvatarUrls } from "@/lib/email-sender-display";
import type { ContactCardData, ContactTimelineItem } from "./inbox-types";

const DRAWER_WIDTH = "88vw";
const SIDEBAR_WIDTH = 320;
const line = "var(--scout-border)";

type ActivityFilter = "all" | "email" | "meeting";

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupTimelineByDay(items: ContactTimelineItem[]): { label: string; items: ContactTimelineItem[] }[] {
  const map = new Map<string, ContactTimelineItem[]>();
  for (const item of items) {
    const key = item.occurredAt
      ? new Date(item.occurredAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
      : "Unknown date";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()].map(([label, rows]) => ({ label, items: rows }));
}

function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  };
  return (
    <div style={{ borderBottom: line }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "12px 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          letterSpacing: "0.05em",
          color: color.muted,
          textTransform: "uppercase",
        }}
      >
        <span>
          {title}
          {count !== undefined ? ` (${count})` : ""}
        </span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ padding: "0 16px 14px" }}>{children}</div>}
    </div>
  );
}

function TimelineRow({
  item,
  onOpenMessage,
}: {
  item: ContactTimelineItem;
  onOpenMessage?: (messageId: string) => void;
}) {
  const clickable = Boolean(item.nylasMessageId && onOpenMessage);
  const isEmail = item.kind === "EMAIL";
  const icon = isEmail ? "✉" : "📅";
  const title = item.subject ?? (isEmail ? "Email" : "Meeting");

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => item.nylasMessageId && onOpenMessage?.(item.nylasMessageId)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        border: line,
        borderRadius: 8,
        background: "#fff",
        marginBottom: 8,
        cursor: clickable ? "pointer" : "default",
        opacity: clickable ? 1 : 0.92,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: isEmail ? "rgba(59,130,246,0.12)" : "rgba(42,107,74,0.1)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, flex: 1, minWidth: 0 }}>
              {title}
            </span>
            <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, flexShrink: 0 }}>
              {formatRelative(item.occurredAt)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textTransform: "capitalize" }}>
              {item.direction.toLowerCase()}
            </span>
            <InboxStatusPills userTag={item.userTag as InboxUserTag | null} category={item.category} compact />
          </div>
          {item.snippet && (
            <p
              style={{
                margin: 0,
                fontFamily: fontSans,
                fontSize: T.bodySm,
                color: color.muted,
                lineHeight: 1.45,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {item.snippet}
            </p>
          )}
          {clickable && (
            <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, marginTop: 6, display: "inline-block" }}>
              Open email →
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

type Props = {
  contactId: string;
  scopePath: (path: string) => string;
  onClose: () => void;
  onOpenMessage?: (messageId: string) => void;
  onComposeTo?: (email: string, name: string | null) => void;
  onNotice?: (n: { type: "success" | "error"; text: string }) => void;
  mailConnected?: boolean;
};

export function InboxContactDrawer({
  contactId,
  scopePath,
  onClose,
  onOpenMessage,
  onComposeTo,
  onNotice,
  mailConnected = true,
}: Props) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<ContactCardData | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [search, setSearch] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [saveSaving, setSaveSaving] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [jobLinkSaving, setJobLinkSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(scopePath(`/api/user/inbox/contacts/${encodeURIComponent(contactId)}`));
      if (!res.ok) throw new Error("Could not load contact");
      setCard(await res.json());
    } catch {
      onNotice?.({ type: "error", text: "Could not load contact." });
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [contactId, scopePath, onNotice]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const displayName = card?.contact.name ?? card?.contact.email ?? "Contact";
  const avatar = card ? buildSenderAvatarUrls(card.contact.name ?? card.contact.email, card.contact.email) : null;

  const latestEmailActivity = useMemo(
    () => card?.timeline.find((t) => t.kind === "EMAIL" && t.nylasMessageId) ?? null,
    [card?.timeline],
  );

  const filteredTimeline = useMemo(() => {
    if (!card) return [];
    let rows = card.timeline;
    if (filter === "email") rows = rows.filter((t) => t.kind === "EMAIL");
    if (filter === "meeting") rows = rows.filter((t) => t.kind === "MEETING");
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          (t.subject ?? "").toLowerCase().includes(q) ||
          (t.snippet ?? "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [card, filter, search]);

  const grouped = useMemo(() => groupTimelineByDay(filteredTimeline), [filteredTimeline]);

  async function updateContactStatus(status: InboxContactStatus) {
    setStatusSaving(true);
    try {
      const res = await fetch(scopePath(`/api/user/inbox/contacts/${encodeURIComponent(contactId)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Could not save status");
      await load();
    } catch (e) {
      onNotice?.({ type: "error", text: e instanceof Error ? e.message : "Could not save status." });
    } finally {
      setStatusSaving(false);
    }
  }

  async function saveContact() {
    setSaveSaving(true);
    try {
      const res = await fetch(scopePath(`/api/user/inbox/contacts/${encodeURIComponent(contactId)}/save`), {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save contact");
      onNotice?.({ type: "success", text: "Contact saved to your address book." });
      await load();
    } catch (e) {
      onNotice?.({
        type: "error",
        text: e instanceof Error ? e.message : "Could not save contact — reconnect inbox for contacts access.",
      });
    } finally {
      setSaveSaving(false);
    }
  }

  async function linkJobViaContact(jobId: string | null) {
    setJobLinkSaving(true);
    try {
      const res = await fetch(
        scopePath(`/api/user/inbox/contacts/${encodeURIComponent(contactId)}/job`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            jobId
              ? { jobId }
              : { jobId: null, unlinkJobId: card?.linkedJobs[0]?.id ?? null },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not link opportunity");
      onNotice?.({ type: "success", text: jobId ? "Linked to opportunity." : "Link removed." });
      await load();
    } catch (e) {
      onNotice?.({ type: "error", text: e instanceof Error ? e.message : "Could not link opportunity." });
    } finally {
      setJobLinkSaving(false);
    }
  }

  async function createAndLinkJobViaContact(company: string, role: string) {
    setJobLinkSaving(true);
    try {
      const res = await fetch(
        scopePath(`/api/user/inbox/contacts/${encodeURIComponent(contactId)}/job`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ create: { company, role } }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create opportunity");
      onNotice?.({ type: "success", text: "Opportunity created and linked." });
      await load();
    } catch (e) {
      onNotice?.({ type: "error", text: e instanceof Error ? e.message : "Could not create opportunity." });
    } finally {
      setJobLinkSaving(false);
    }
  }

  async function linkJob(jobId: string | null) {
    if (!latestEmailActivity?.nylasMessageId) {
      await linkJobViaContact(jobId);
      return;
    }
    setJobLinkSaving(true);
    try {
      const res = await fetch(
        scopePath(`/api/user/email/messages/${encodeURIComponent(latestEmailActivity.nylasMessageId)}/job`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not link opportunity");
      onNotice?.({ type: "success", text: jobId ? "Linked to opportunity." : "Link removed." });
      await load();
    } catch (e) {
      onNotice?.({ type: "error", text: e instanceof Error ? e.message : "Could not link opportunity." });
    } finally {
      setJobLinkSaving(false);
    }
  }

  async function createAndLinkJob(company: string, role: string) {
    if (!latestEmailActivity?.nylasMessageId) {
      await createAndLinkJobViaContact(company, role);
      return;
    }
    setJobLinkSaving(true);
    try {
      const res = await fetch(
        scopePath(`/api/user/email/messages/${encodeURIComponent(latestEmailActivity.nylasMessageId)}/job`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ create: { company, role } }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create opportunity");
      onNotice?.({ type: "success", text: "Opportunity created and linked." });
      await load();
    } catch (e) {
      onNotice?.({ type: "error", text: e instanceof Error ? e.message : "Could not create opportunity." });
    } finally {
      setJobLinkSaving(false);
    }
  }

  useEffect(() => {
    setNotesDraft(card?.contact.notes ?? "");
  }, [card?.contact.notes]);

  async function saveNotes() {
    if (!card) return;
    setNotesSaving(true);
    try {
      const res = await fetch(scopePath(`/api/user/inbox/contacts/${encodeURIComponent(contactId)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!res.ok) throw new Error("Could not save note");
      onNotice?.({ type: "success", text: "Note saved." });
      await load();
    } catch (e) {
      onNotice?.({ type: "error", text: e instanceof Error ? e.message : "Could not save note." });
    } finally {
      setNotesSaving(false);
    }
  }

  function openNotes() {
    setNotesOpen(true);
    window.setTimeout(() => notesRef.current?.focus(), 50);
  }

  const headerBtn = {
    display: "inline-flex" as const,
    alignItems: "center" as const,
    gap: 6,
    padding: "8px 14px",
    borderRadius: 8,
    border: line,
    background: "#fff",
    fontFamily: fontSans,
    fontSize: T.bodySm,
    fontWeight: 600,
    color: color.ink,
    cursor: "pointer" as const,
    whiteSpace: "nowrap" as const,
  };

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.22)", zIndex: 80 }} />
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : 10,
          right: isMobile ? 0 : 10,
          bottom: isMobile ? 0 : 10,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 20px)",
          background: surface.page,
          overflow: "hidden",
          zIndex: 90,
          boxShadow: isMobile ? "none" : "0 8px 40px rgba(0,0,0,0.12)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 20px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header — Close-style: identity + status left, CTAs right */}
        <div
          style={{
            padding: isMobile ? "14px 16px" : "18px 24px",
            background: surface.card,
            borderBottom: line,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: color.muted, padding: 0, marginTop: 4 }}
            >
              ×
            </button>

            {!loading && avatar && (
              <SenderAvatar
                primary={avatar.primary}
                fallback={avatar.fallback}
                initials={avatar.initials}
                displayName={avatar.displayName}
                size={48}
              />
            )}

            <div style={{ flex: 1, minWidth: 180 }}>
              <p
                style={{
                  ...displayTitleStyle(T.displaySm),
                  margin: "0 0 10px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? "Loading…" : displayName}
              </p>
              {!loading && card && (
                <InboxContactStatusPicker
                  value={card.contact.status}
                  disabled={statusSaving}
                  onChange={(status) => void updateContactStatus(status)}
                />
              )}
            </div>

            {!loading && card && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginLeft: "auto" }}>
                <button type="button" style={headerBtn} onClick={openNotes}>
                  <span aria-hidden>📝</span> Note
                </button>
                <button
                  type="button"
                  style={{ ...headerBtn, opacity: mailConnected ? 1 : 0.5 }}
                  disabled={!mailConnected}
                  title={mailConnected ? undefined : "Connect inbox to send email"}
                  onClick={() => mailConnected && onComposeTo?.(card.contact.email, card.contact.name)}
                >
                  <span aria-hidden>✉</span> Email
                </button>
                {card.contact.phone ? (
                  <a
                    href={`tel:${card.contact.phone.replace(/\s/g, "")}`}
                    style={{ ...headerBtn, textDecoration: "none" }}
                  >
                    <span aria-hidden>📞</span> Call
                  </a>
                ) : (
                  <button type="button" style={{ ...headerBtn, opacity: 0.45, cursor: "not-allowed" }} disabled title="No phone number">
                    <span aria-hidden>📞</span> Call
                  </button>
                )}
                <button type="button" style={headerBtn} disabled={jobLinkSaving} onClick={() => setLinkOpen(true)}>
                  <span aria-hidden>🏆</span> Opportunity
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            overflow: isMobile ? "auto" : "hidden",
          }}
        >
          {/* Left details sidebar */}
          <aside
            style={{
              width: isMobile ? "100%" : SIDEBAR_WIDTH,
              flexShrink: 0,
              borderRight: isMobile ? "none" : line,
              borderBottom: isMobile ? line : "none",
              background: surface.card,
              overflowY: isMobile ? "visible" : "auto",
            }}
          >
            {loading && (
              <p style={{ padding: 16, fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>Loading…</p>
            )}
            {!loading && card && (
              <>
                <div style={{ padding: "12px 16px", borderBottom: line, display: "flex", gap: 16 }}>
                  <span
                    style={{
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      fontWeight: 700,
                      color: color.forest,
                      borderBottom: `2px solid ${color.forest}`,
                      paddingBottom: 6,
                    }}
                  >
                    Details
                  </span>
                </div>

                <CollapsibleSection title="About" defaultOpen>
                  <div style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.65 }}>
                    <p style={{ margin: "0 0 8px" }}>
                      <span style={{ color: color.muted }}>Email · </span>
                      {card.contact.email}
                    </p>
                    {card.contact.company && (
                      <p style={{ margin: "0 0 8px" }}>
                        <span style={{ color: color.muted }}>Company · </span>
                        {card.contact.company}
                      </p>
                    )}
                    {card.contact.title && (
                      <p style={{ margin: "0 0 8px" }}>
                        <span style={{ color: color.muted }}>Title · </span>
                        {card.contact.title}
                      </p>
                    )}
                    {card.contact.phone && (
                      <p style={{ margin: "0 0 8px" }}>
                        <span style={{ color: color.muted }}>Phone · </span>
                        <a href={`tel:${card.contact.phone.replace(/\s/g, "")}`} style={{ color: "#2563EB" }}>
                          {card.contact.phone}
                        </a>
                      </p>
                    )}
                    {card.contact.linkedinUrl && (
                      <p style={{ margin: "0 0 8px" }}>
                        <span style={{ color: color.muted }}>LinkedIn · </span>
                        <a href={card.contact.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: "#2563EB" }}>
                          Profile
                        </a>
                      </p>
                    )}
                    {card.contact.contacted != null && (
                      <p style={{ margin: "0 0 8px" }}>
                        <span style={{ color: color.muted }}>Contacted · </span>
                        {card.contact.contacted ? "Yes" : "No"}
                      </p>
                    )}
                    {card.contact.notes && !notesOpen && (
                      <p style={{ margin: 0 }}>
                        <span style={{ color: color.muted }}>Notes · </span>
                        {card.contact.notes}
                      </p>
                    )}
                    {card.contact.savedToNylas && (
                      <p style={{ margin: "10px 0 0", fontSize: T.caption, color: color.forest, fontWeight: 600 }}>
                        Saved to address book
                      </p>
                    )}
                    {!card.contact.savedToNylas && (
                      <button
                        type="button"
                        disabled={saveSaving}
                        onClick={() => void saveContact()}
                        style={{
                          marginTop: 12,
                          padding: 0,
                          border: "none",
                          background: "none",
                          fontFamily: fontSans,
                          fontSize: T.caption,
                          fontWeight: 600,
                          color: color.forest,
                          cursor: "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        {saveSaving ? "Saving…" : "Save to address book"}
                      </button>
                    )}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Notes" count={notesDraft.trim() ? 1 : 0} open={notesOpen} onOpenChange={setNotesOpen}>
                  <textarea
                    ref={notesRef}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    placeholder="Add a note about this contact…"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      border: line,
                      borderRadius: 8,
                      fontFamily: fontSans,
                      fontSize: T.bodySm,
                      lineHeight: 1.5,
                      resize: "vertical",
                    }}
                  />
                  <button
                    type="button"
                    disabled={notesSaving || notesDraft === (card.contact.notes ?? "")}
                    onClick={() => void saveNotes()}
                    style={{
                      marginTop: 8,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: color.forest,
                      color: "#fff",
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      fontWeight: 600,
                      cursor: notesSaving ? "wait" : "pointer",
                      opacity: notesDraft === (card.contact.notes ?? "") ? 0.5 : 1,
                    }}
                  >
                    {notesSaving ? "Saving…" : "Save note"}
                  </button>
                </CollapsibleSection>

                <CollapsibleSection title="Opportunities" count={card.linkedJobs.length}>
                  {card.linkedJobs.length === 0 ? (
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                      No linked opportunities yet.
                    </p>
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {card.linkedJobs.map((job) => (
                        <li key={job.id} style={{ marginBottom: 10 }}>
                          <Link
                            href={pipelineJobUrl(job.id)}
                            style={{
                              fontFamily: fontSans,
                              fontSize: T.bodySm,
                              fontWeight: 600,
                              color: color.forest,
                              textDecoration: "none",
                            }}
                          >
                            {job.role} @ {job.company}
                          </Link>
                          <span style={{ fontFamily: fontMono, fontSize: T.label, color: color.muted, marginLeft: 8 }}>
                            {job.stage.toLowerCase()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CollapsibleSection>

                <CollapsibleSection title="Activity" count={card.activityCount ?? card.timeline.length} defaultOpen={false}>
                  <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                    {card.activityCount ?? card.timeline.length} logged interaction
                    {(card.activityCount ?? card.timeline.length) === 1 ? "" : "s"} with this contact.
                  </p>
                </CollapsibleSection>
              </>
            )}
          </aside>

          {/* Activity timeline */}
          <main
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: isMobile ? "visible" : "auto",
              padding: isMobile ? "16px" : "20px 24px",
              background: surface.page,
            }}
          >
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: T.heading, fontWeight: 700, color: color.ink }}>
              Activity
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
              }}
            >
              {(["all", "email", "meeting"] as ActivityFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: filter === f ? `1px solid ${color.forest}` : line,
                    background: filter === f ? "rgba(42,107,74,0.08)" : "#fff",
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    fontWeight: filter === f ? 700 : 500,
                    color: filter === f ? color.forest : color.muted,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {f === "all" ? "All" : f === "email" ? "Emails" : "Meetings"}
                </button>
              ))}
              <input
                type="search"
                placeholder="Search activity…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 160,
                  marginLeft: "auto",
                  padding: "9px 12px",
                  border: line,
                  borderRadius: 8,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  background: "#fff",
                }}
              />
            </div>
          </div>

            {loading && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>Loading activity…</p>
            )}
            {!loading && filteredTimeline.length === 0 && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                No activity yet for this contact.
              </p>
            )}

            {grouped.map((group) => (
              <div key={group.label} style={{ marginBottom: 20 }}>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontFamily: fontSans,
                    fontSize: T.label,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    color: color.muted,
                    textTransform: "uppercase",
                  }}
                >
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <TimelineRow
                    key={item.id}
                    item={item}
                    onOpenMessage={
                      onOpenMessage
                        ? (id) => {
                            close();
                            onOpenMessage(id);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </main>
        </div>
      </div>

      {card && (
        <InboxLinkOpportunityModal
          open={linkOpen}
          subject={latestEmailActivity?.subject ?? displayName}
          linkedJobId={card.linkedJobs[0]?.id ?? null}
          saving={jobLinkSaving}
          scopePath={scopePath}
          onClose={() => setLinkOpen(false)}
          onLink={(jobId) => {
            void linkJob(jobId);
            setLinkOpen(false);
          }}
          onCreateAndLink={(company, role) => {
            void createAndLinkJob(company, role);
            setLinkOpen(false);
          }}
          onUnlink={() => {
            void linkJob(null);
            setLinkOpen(false);
          }}
        />
      )}
    </>
  );
}

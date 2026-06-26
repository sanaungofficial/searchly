"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AdminClient } from "@/components/admin/admin-clients-panel";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { ExpertInboxClientPanel } from "@/components/scout/expert-inbox-client-panel";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { WorkspaceLive } from "@/components/scout/workspace-live";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CoachClientSummary, HubBooking, HubCommunication } from "@/lib/coach-hub";
import { navigateToAdminClientProfile } from "@/lib/admin-client-navigation";
import { border, color, fontMono, fontSans, radius, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";

type HubPayload = {
  clients: CoachClientSummary[];
  communications: HubCommunication[];
  upcomingBookings: HubBooking[];
  pastBookings?: HubBooking[];
};

type InboxFilter = "all" | "requests";
type InboxSection = "bookings" | "live";

function commLabel(type: HubCommunication["type"]) {
  switch (type) {
    case "GUEST_CONFIRMATION":
      return "Confirmation sent";
    case "COACH_NOTIFICATION":
      return "Coach notified";
    case "CANCELLATION":
    case "SESSION_CANCELLED":
      return "Session cancelled";
    case "SESSION_BOOKED":
      return "New session request";
    case "SESSION_RESCHEDULED":
      return "Reschedule request";
    default:
      return "Update";
  }
}

function isRequestComm(c: HubCommunication) {
  return (
    c.type === "SESSION_BOOKED" ||
    c.type === "SESSION_RESCHEDULED" ||
    c.type === "SESSION_CANCELLED" ||
    c.type === "CANCELLATION" ||
    c.type === "GUEST_CONFIRMATION"
  );
}

function clientKey(c: CoachClientSummary) {
  return c.userId ?? c.email;
}

function commMatchesClient(c: HubCommunication, client: CoachClientSummary) {
  const email = client.email.toLowerCase();
  return c.clientEmail?.toLowerCase() === email;
}

function bookingMatchesClient(b: HubBooking, client: CoachClientSummary) {
  const email = client.email.toLowerCase();
  return b.guestEmail?.toLowerCase() === email;
}

function formatDayDivider(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function groupCommsByDay(comms: HubCommunication[]) {
  const groups: { day: string; items: HubCommunication[] }[] = [];
  for (const c of comms) {
    const day = formatDayDivider(c.createdAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(c);
    else groups.push({ day, items: [c] });
  }
  return groups;
}

function ActionsMenu({
  vouchUrl,
  clientEmail,
  onViewClients,
}: {
  vouchUrl: string | null;
  clientEmail: string;
  onViewClients: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function copyVouchLink() {
    if (!vouchUrl) return;
    try {
      await navigator.clipboard.writeText(vouchUrl);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <ScoutSecondaryBtn type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Actions ▾
      </ScoutSecondaryBtn>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 220,
            background: surface.card,
            border: border.line,
            borderRadius: radius.box,
            boxShadow: "var(--scout-shadow-card-strong)",
            zIndex: 20,
            overflow: "hidden",
          }}
        >
          {vouchUrl && (
            <button
              type="button"
              onClick={() => void copyVouchLink()}
              style={actionItemStyle}
            >
              ★ Request a review
            </button>
          )}
          <Link href={`/inbox?mode=expert`} style={{ ...actionItemStyle, display: "block", textDecoration: "none" }} onClick={() => setOpen(false)}>
            ✉ Email client
          </Link>
          <button type="button" onClick={() => { onViewClients(); setOpen(false); }} style={actionItemStyle}>
            ⊞ Open in Clients
          </button>
          <p style={{ margin: 0, padding: "8px 14px 10px", fontFamily: fontSans, fontSize: 11, color: color.muted, borderTop: border.line }}>
            {clientEmail}
          </p>
        </div>
      )}
    </div>
  );
}

const actionItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "11px 14px",
  border: "none",
  background: "transparent",
  fontFamily: fontSans,
  fontSize: 13,
  fontWeight: 500,
  color: color.ink,
  cursor: "pointer",
};

export function ExpertInboxView() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAdminUi } = useWorkspace();
  const [section, setSection] = useState<InboxSection>("bookings");
  const [data, setData] = useState<HubPayload | null>(null);
  const [clientProfiles, setClientProfiles] = useState<AdminClient[]>([]);
  const [vouchUrl, setVouchUrl] = useState<string | null>(null);
  const [clientPastBookings, setClientPastBookings] = useState<HubBooking[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/coach/hub")
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load inbox");
        return r.json() as Promise<HubPayload>;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const next = searchParams.get("section");
    if (next === "live" || next === "bookings") setSection(next);
  }, [searchParams]);

  useEffect(() => {
    load();
    fetch("/api/coach/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setClientProfiles(Array.isArray(rows) ? rows : []))
      .catch(() => setClientProfiles([]));
    fetch("/api/coach/vouches")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setVouchUrl(d?.vouchUrl ?? null))
      .catch(() => setVouchUrl(null));
  }, [load]);

  const threadRows = useMemo(() => {
    const clients = data?.clients ?? [];
    const rows = clients.map((client) => {
      const comms = (data?.communications ?? []).filter((c) => commMatchesClient(c, client));
      const upcoming = (data?.upcomingBookings ?? []).filter((b) => bookingMatchesClient(b, client));
      const pending = upcoming.filter((b) => b.status === "PENDING");
      const lastActivity = comms[0]?.createdAt ?? client.nextSessionAt ?? client.lastSessionAt ?? "";
      const preview = comms[0]?.subject ?? (pending.length ? "Session request pending" : "No recent activity");
      const hasRequest = pending.length > 0 || comms.some(isRequestComm);
      return { client, preview, lastActivity, hasRequest, upcoming, comms, pending };
    });
    rows.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
    if (filter === "requests") return rows.filter((r) => r.hasRequest);
    return rows;
  }, [data, filter]);

  useEffect(() => {
    if (threadRows.length > 0 && !selectedKey) {
      setSelectedKey(clientKey(threadRows[0].client));
    }
  }, [threadRows, selectedKey]);

  const selected = threadRows.find((r) => clientKey(r.client) === selectedKey) ?? null;

  const selectedProfile = useMemo(() => {
    if (!selected) return null;
    return (
      clientProfiles.find((c) => c.id === selected.client.userId) ??
      clientProfiles.find((c) => c.email.toLowerCase() === selected.client.email.toLowerCase()) ??
      null
    );
  }, [clientProfiles, selected]);

  useEffect(() => {
    if (!selected) {
      setClientPastBookings([]);
      return;
    }
    const params = new URLSearchParams();
    if (selected.client.userId) params.set("clientUserId", selected.client.userId);
    else params.set("clientEmail", selected.client.email);
    setLoadingPast(true);
    fetch(`/api/coach/hub?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: HubPayload | null) => setClientPastBookings(payload?.pastBookings ?? []))
      .catch(() => setClientPastBookings([]))
      .finally(() => setLoadingPast(false));
  }, [selected]);

  const requestFeed = useMemo(() => {
    return (data?.communications ?? []).filter(isRequestComm).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data?.communications]);

  const commGroups = useMemo(
    () => groupCommsByDay(selected?.comms ?? []),
    [selected?.comms],
  );

  function selectClient(key: string) {
    setSelectedKey(key);
    if (isMobile) setMobilePane("detail");
  }

  function selectSection(next: InboxSection) {
    setSection(next);
    router.replace(next === "bookings" ? "/expert/inbox" : `/expert/inbox?section=${next}`, { scroll: false });
  }

  function openClients() {
    router.push("/expert/ops?section=clients");
  }

  if (loading && !data) {
    return <div style={{ padding: 24, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Loading inbox…</div>;
  }

  if (error || !data) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontFamily: fontSans, color: "#dc2626", margin: "0 0 12px" }}>{error ?? "Unable to load inbox"}</p>
        <ScoutSecondaryBtn type="button" onClick={load}>Retry</ScoutSecondaryBtn>
      </div>
    );
  }

  const showList = !isMobile || mobilePane === "list";
  const showDetail = !isMobile || mobilePane === "detail";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <header style={{ padding: isMobile ? "14px 16px" : "18px 24px", borderBottom: border.line, background: surface.card, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: fontSans, fontSize: isMobile ? 20 : 22, fontWeight: 600, color: color.forest }}>Inbox</h1>
            <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.45 }}>
              Session requests, booking updates, and live event setup.
            </p>
          </div>
          {section === "bookings" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, display: "flex", alignItems: "center", gap: 6 }}>
                Show
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as InboxFilter)}
                  style={{ fontFamily: fontSans, fontSize: T.caption, padding: "6px 10px", border: border.line, borderRadius: radius.box, background: "#fff" }}
                >
                  <option value="all">All clients</option>
                  <option value="requests">Requests only</option>
                </select>
              </label>
              <Link href="/inbox?mode=expert" style={{ textDecoration: "none" }}>
                <ScoutSecondaryBtn type="button">Expert mail</ScoutSecondaryBtn>
              </Link>
            </div>
          )}
        </div>
        <WorkspaceSegmentTabs
          isMobile={isMobile}
          tabs={[
            { id: "bookings" as const, label: "Bookings" },
            { id: "live" as const, label: "Live" },
          ]}
          active={section}
          onChange={selectSection}
        />
      </header>

      {section === "live" ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isMobile ? "16px 16px 32px" : "20px 24px 32px" }}>
          <WorkspaceLive embedded />
        </div>
      ) : (
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        {showList && (
          <aside style={{ width: isMobile ? "100%" : 300, flexShrink: 0, borderRight: isMobile ? "none" : border.line, overflowY: "auto", background: surface.inset }}>
            {threadRows.length === 0 ? (
              <p style={{ padding: 20, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                {filter === "requests" ? "No open requests right now." : "No clients yet — bookings will appear here."}
              </p>
            ) : (
              threadRows.map(({ client, preview, lastActivity, hasRequest, pending }) => {
                const key = clientKey(client);
                const active = selectedKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectClient(key)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "14px 16px",
                      border: "none",
                      borderBottom: border.line,
                      background: active ? surface.card : "transparent",
                      cursor: "pointer",
                      borderLeft: active ? `3px solid ${color.forest}` : "3px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <CoachAvatar name={client.name ?? client.email} photoUrl={null} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink }}>
                            {client.name ?? client.email.split("@")[0]}
                          </p>
                          {lastActivity && (
                            <span style={{ fontFamily: fontSans, fontSize: 11, color: color.muted, whiteSpace: "nowrap" }}>
                              {new Date(lastActivity).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: color.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {preview}
                        </p>
                        {(hasRequest || pending.length > 0) && (
                          <span style={{ display: "inline-block", marginTop: 6, fontFamily: fontMono, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: color.forest, background: "rgba(42,107,74,0.1)", padding: "2px 6px", borderRadius: radius.box }}>
                            {pending.length ? "Request" : "Update"}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </aside>
        )}

        {showDetail && (
          <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", background: surface.page }}>
            {isMobile && (
              <button type="button" onClick={() => setMobilePane("list")} style={{ margin: "12px 16px 0", background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: 13, color: color.forest, cursor: "pointer" }}>
                ← All clients
              </button>
            )}

            {!selected ? (
              <div style={{ padding: isMobile ? 16 : 24, overflowY: "auto" }}>
                <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: color.ink, margin: "0 0 12px" }}>Recent requests</p>
                {requestFeed.length === 0 ? (
                  <ScoutBox padding={20}>
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
                      Select a client on the left, or wait for new session requests.
                    </p>
                  </ScoutBox>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {requestFeed.slice(0, 12).map((c) => (
                      <ScoutBox key={c.id} padding={16}>
                        <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 14, fontWeight: 600 }}>{c.subject}</p>
                        <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                          {commLabel(c.type)} · {new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                        {c.bodyPreview && <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.stone, lineHeight: 1.5 }}>{c.bodyPreview}</p>}
                      </ScoutBox>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: isMobile ? "column" : "row" }}>
                {/* Center thread */}
                <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", borderRight: isMobile ? "none" : border.line }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: isMobile ? "14px 16px" : "16px 20px",
                      borderBottom: border.line,
                      background: surface.card,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <CoachAvatar name={selected.client.name ?? selected.client.email} photoUrl={null} size={40} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 16, fontWeight: 600, color: color.ink }}>
                          {selected.client.name ?? selected.client.email.split("@")[0]}
                        </p>
                        <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 12, color: color.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {selected.client.email}
                        </p>
                      </div>
                    </div>
                    <ActionsMenu vouchUrl={vouchUrl} clientEmail={selected.client.email} onViewClients={openClients} />
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px" : "20px 24px" }}>
                    {selected.comms.length === 0 ? (
                      <ScoutBox padding={20}>
                        <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
                          No activity yet. Session requests and booking updates will appear here.
                        </p>
                      </ScoutBox>
                    ) : (
                      commGroups.map(({ day, items }) => (
                        <div key={day} style={{ marginBottom: 24 }}>
                          <p
                            style={{
                              margin: "0 0 14px",
                              textAlign: "center",
                              fontFamily: fontMono,
                              fontSize: 11,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: color.muted,
                            }}
                          >
                            {day}
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {items.map((c) => (
                              <ScoutBox key={c.id} padding={16}>
                                <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink }}>{c.subject}</p>
                                <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                                  {commLabel(c.type)} · {new Date(c.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                                </p>
                                {c.bodyPreview && (
                                  <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.stone, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                                    {c.bodyPreview}
                                  </p>
                                )}
                              </ScoutBox>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div
                    style={{
                      flexShrink: 0,
                      padding: isMobile ? "12px 16px 16px" : "14px 20px 18px",
                      borderTop: border.line,
                      background: surface.card,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        border: border.line,
                        borderRadius: radius.box,
                        background: surface.inset,
                      }}
                    >
                      <input
                        type="text"
                        readOnly
                        placeholder="Reply by email — in-app messaging coming later"
                        style={{
                          flex: 1,
                          border: "none",
                          background: "transparent",
                          fontFamily: fontSans,
                          fontSize: 13,
                          color: color.muted,
                          outline: "none",
                        }}
                      />
                      <Link href="/inbox?mode=expert" style={{ textDecoration: "none", flexShrink: 0 }}>
                        <ScoutPrimaryBtn type="button" style={{ minHeight: 36, padding: "0 14px" }}>
                          Open mail
                        </ScoutPrimaryBtn>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Right context rail */}
                <aside
                  style={{
                    width: isMobile ? "100%" : 320,
                    flexShrink: 0,
                    overflowY: "auto",
                    padding: isMobile ? "16px" : "20px 16px 24px",
                    background: isMobile ? surface.page : surface.inset,
                    borderTop: isMobile ? border.line : "none",
                  }}
                >
                  {loadingPast && clientPastBookings.length === 0 ? (
                    <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>Loading client details…</p>
                  ) : (
                    <ExpertInboxClientPanel
                      client={selected.client}
                      clientProfile={selectedProfile}
                      upcoming={selected.upcoming}
                      past={clientPastBookings}
                      vouchUrl={vouchUrl}
                      onViewClients={openClients}
                      onViewClientProfile={showAdminUi ? (userId) => void navigateToAdminClientProfile(userId) : undefined}
                    />
                  )}
                </aside>
              </div>
            )}
          </main>
        )}
      </div>
      )}
    </div>
  );
}

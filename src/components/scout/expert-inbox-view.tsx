"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { BookingsList } from "@/components/scout/bookings-list";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import type { CoachClientSummary, HubBooking, HubCommunication } from "@/lib/coach-hub";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";

type HubPayload = {
  clients: CoachClientSummary[];
  communications: HubCommunication[];
  upcomingBookings: HubBooking[];
};

type InboxFilter = "all" | "requests";

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

export function ExpertInboxView() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [data, setData] = useState<HubPayload | null>(null);
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
    load();
  }, [load]);

  const threadRows = useMemo(() => {
    const clients = data?.clients ?? [];
    const rows = clients.map((client) => {
      const comms = (data?.communications ?? []).filter((c) => commMatchesClient(c, client));
      const upcoming = (data?.upcomingBookings ?? []).filter(
        (b) => b.guestEmail?.toLowerCase() === client.email.toLowerCase(),
      );
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

  const selected = threadRows.find((r) => clientKey(r.client) === selectedKey) ?? null;

  const requestFeed = useMemo(() => {
    return (data?.communications ?? []).filter(isRequestComm).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data?.communications]);

  function selectClient(key: string) {
    setSelectedKey(key);
    if (isMobile) setMobilePane("detail");
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: fontSans, fontSize: isMobile ? 20 : 22, fontWeight: 600, color: color.forest }}>Inbox</h1>
            <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
              Client requests, session updates, and messages that need your attention.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, display: "flex", alignItems: "center", gap: 6 }}>
              Show
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as InboxFilter)}
                style={{ fontFamily: fontSans, fontSize: T.caption, padding: "6px 10px", border: border.line, background: "#fff" }}
              >
                <option value="all">All clients</option>
                <option value="requests">Requests only</option>
              </select>
            </label>
            <Link href="/inbox?mode=expert" style={{ textDecoration: "none" }}>
              <ScoutSecondaryBtn type="button">Expert mail</ScoutSecondaryBtn>
            </Link>
          </div>
        </div>
      </header>

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
                          <span style={{ display: "inline-block", marginTop: 6, fontFamily: fontSans, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: color.forest, background: "rgba(42,107,74,0.1)", padding: "2px 6px" }}>
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
          <main style={{ flex: 1, minWidth: 0, overflowY: "auto", background: surface.page }}>
            {isMobile && (
              <button type="button" onClick={() => setMobilePane("list")} style={{ margin: "12px 16px 0", background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: 13, color: color.forest, cursor: "pointer" }}>
                ← All clients
              </button>
            )}

            {!selected ? (
              <div style={{ padding: isMobile ? 16 : 24 }}>
                <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: color.ink, margin: "0 0 12px" }}>Recent requests</p>
                {requestFeed.length === 0 ? (
                  <ScoutBox padding={20}>
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
                      Select a client on the left, or wait for new session requests. Booking confirmations and reschedules will show up here.
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
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100%" }}>
                <div style={{ flex: 1, minWidth: 0, padding: isMobile ? 16 : 24, borderRight: isMobile ? "none" : border.line }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <CoachAvatar name={selected.client.name ?? selected.client.email} photoUrl={null} size={48} />
                    <div>
                      <p style={{ margin: 0, fontFamily: fontSans, fontSize: 18, fontWeight: 600 }}>{selected.client.name ?? selected.client.email}</p>
                      <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>{selected.client.email}</p>
                    </div>
                  </div>

                  <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 10px" }}>Activity</p>
                  {selected.comms.length === 0 ? (
                    <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>No messages yet for this client.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {selected.comms.map((c) => (
                        <div key={c.id} style={{ borderLeft: `3px solid ${color.forest}`, paddingLeft: 12 }}>
                          <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 14, fontWeight: 600 }}>{c.subject}</p>
                          <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 12, color: color.muted }}>
                            {commLabel(c.type)} · {new Date(c.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                          {c.bodyPreview && <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.stone, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{c.bodyPreview}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: 24, padding: 16, border: border.line, background: surface.card }}>
                    <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                      Reply by email from Expert mail or your connected calendar — in-app messaging comes later.
                    </p>
                    <Link href="/inbox?mode=expert" style={{ textDecoration: "none" }}>
                      <ScoutPrimaryBtn type="button">Open expert mail</ScoutPrimaryBtn>
                    </Link>
                  </div>
                </div>

                {!isMobile && (
                  <aside style={{ width: 280, flexShrink: 0, padding: 24, background: surface.card }}>
                    <ClientContextPanel
                      client={selected.client}
                      upcoming={selected.upcoming}
                      onViewClient={() => router.push("/dashboard/ops?section=clients")}
                    />
                  </aside>
                )}
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

function ClientContextPanel({
  client,
  upcoming,
  onViewClient,
}: {
  client: CoachClientSummary;
  upcoming: HubBooking[];
  onViewClient: () => void;
}) {
  return (
    <div>
      <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 14px" }}>Client info</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, fontFamily: fontSans, fontSize: 13, color: color.stone }}>
        <p style={{ margin: 0 }}>{client.sessionCount} session{client.sessionCount === 1 ? "" : "s"} total</p>
        {client.upcomingCount > 0 && <p style={{ margin: 0 }}>{client.upcomingCount} upcoming</p>}
        {client.nextSessionAt && (
          <p style={{ margin: 0, color: color.muted }}>
            Next: {new Date(client.nextSessionAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        )}
      </div>

      {upcoming.length > 0 && (
        <>
          <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 10px" }}>Upcoming</p>
          <BookingsList
            bookings={upcoming.map((b) => ({
              id: b.id,
              coachName: b.coachName,
              coachSlug: b.coachSlug,
              guestName: b.guestName,
              guestEmail: b.guestEmail,
              title: b.title,
              location: b.location,
              startAt: b.startAt,
              endAt: b.endAt,
              status: b.status,
              nylasBookingRef: b.nylasBookingRef,
            }))}
            emptyMessage=""
            showGuest={false}
            showCoach={false}
          />
        </>
      )}

      {client.userId && (
        <div style={{ marginTop: 20 }}>
          <ScoutSecondaryBtn type="button" onClick={onViewClient}>View in Ops Tools</ScoutSecondaryBtn>
        </div>
      )}
    </div>
  );
}

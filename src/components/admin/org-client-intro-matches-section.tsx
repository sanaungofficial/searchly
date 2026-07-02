"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

type IntroTrackingRow = {
  id: string;
  status: "REQUESTED" | "SENT" | "DONE" | "DECLINED";
  notes: string | null;
};

type IntroMatchRow = {
  id: string;
  targetCompany: string;
  matchType: string | null;
  strengthScore: number;
  computedAt: string;
  hasOpenRoles: boolean;
  contact: {
    id: string;
    name: string | null;
    email: string;
    company: string | null;
    title: string | null;
    linkedinUrl: string | null;
    lastActivityAt: string | null;
  };
  knownBy: {
    userId: string | null;
    name: string | null;
    email: string | null;
    strengthScore: number;
    lastSeenAt: string | null;
  };
  hirebaseJobs: Array<{ id: string; title: string; url: string | null }>;
  introTracking?: IntroTrackingRow | null;
};

function strengthLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Moderate";
  if (score > 0) return "Light";
  return "New";
}

function strengthColor(score: number): string {
  if (score >= 70) return color.forest;
  if (score >= 40) return "#78716c";
  return color.muted;
}

function composeUrl(email: string): string {
  const params = new URLSearchParams({ section: "inbox", composeTo: email });
  return `/networking?${params.toString()}`;
}

function introStatusLabel(status: IntroTrackingRow["status"] | undefined): string | null {
  if (!status || status === "REQUESTED") return null;
  if (status === "SENT") return "Intro sent";
  if (status === "DONE") return "Done";
  if (status === "DECLINED") return "Declined";
  return null;
}

export function OrgClientIntroMatchesPanel({
  orgId,
  clientUserId,
  clientLabel,
  apiBase = `/api/admin/orgs/${orgId}`,
  readOnly = false,
  defaultExpanded = false,
}: {
  orgId: string;
  clientUserId: string;
  clientLabel: string;
  apiBase?: string;
  readOnly?: boolean;
  defaultExpanded?: boolean;
}) {
  const [matches, setMatches] = useState<IntroMatchRow[]>([]);
  const [loading, setLoading] = useState(defaultExpanded);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [trackingBusyId, setTrackingBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const matchesApi = `${apiBase}/clients/${clientUserId}/intro-matches`;
  const enrichApiBase = apiBase.includes("/api/org/")
    ? `/api/org/${orgId}/contacts`
    : `/api/admin/orgs/${orgId}/contacts`;
  const trackingApi = apiBase.includes("/api/org/")
    ? `/api/org/${orgId}/intro-tracking`
    : null;

  const loadCached = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(matchesApi);
      const data = (await res.json()) as { matches?: IntroMatchRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load intro matches.");
      setMatches(data.matches ?? []);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load intro matches."));
    } finally {
      setLoading(false);
    }
  }, [matchesApi]);

  useEffect(() => {
    if (expanded) void loadCached();
  }, [expanded, loadCached]);

  async function findMatches() {
    if (readOnly) return;
    setFinding(true);
    setError(null);
    setExpanded(true);
    try {
      const res = await fetch(matchesApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeHirebase: true }),
      });
      const data = (await res.json()) as { matches?: IntroMatchRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not compute intro matches.");
      setMatches(data.matches ?? []);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not compute intro matches."));
    } finally {
      setFinding(false);
    }
  }

  async function enrichContact(contactId: string) {
    if (readOnly) return;
    setEnrichingId(contactId);
    setError(null);
    try {
      const res = await fetch(`${enrichApiBase}/${contactId}/enrich`, { method: "POST" });
      const data = (await res.json()) as {
        contact?: IntroMatchRow["contact"];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Sumble enrich failed.");
      if (data.contact) {
        setMatches((prev) =>
          prev.map((row) =>
            row.contact.id === contactId ? { ...row, contact: { ...row.contact, ...data.contact! } } : row,
          ),
        );
      }
    } catch (e) {
      setError(formatApiErrorMessage(e, "Sumble enrich failed."));
    } finally {
      setEnrichingId(null);
    }
  }

  async function updateIntroTracking(contactId: string, status: IntroTrackingRow["status"], existingId?: string) {
    if (!trackingApi || readOnly) return;
    setTrackingBusyId(contactId);
    setError(null);
    try {
      const res = await fetch(trackingApi, {
        method: existingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          existingId
            ? { id: existingId, status }
            : { clientId: clientUserId, orgContactId: contactId, status },
        ),
      });
      const data = (await res.json()) as { tracking?: IntroTrackingRow; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update intro tracking.");
      if (data.tracking) {
        setMatches((prev) =>
          prev.map((row) =>
            row.contact.id === contactId ? { ...row, introTracking: data.tracking! } : row,
          ),
        );
      }
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not update intro tracking."));
    } finally {
      setTrackingBusyId(null);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {!readOnly && (
          <ScoutSecondaryBtn onClick={() => void findMatches()} disabled={finding}>
            {finding ? "Finding matches…" : "Find intro matches"}
          </ScoutSecondaryBtn>
        )}
        {matches.length > 0 && !defaultExpanded && (
          <ScoutSecondaryBtn onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide results" : `Show ${matches.length} match${matches.length === 1 ? "" : "es"}`}
          </ScoutSecondaryBtn>
        )}
      </div>

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "8px 0 0" }}>{error}</p>
      )}

      {expanded && (
        <div
          style={{
            marginTop: 12,
            border: "var(--scout-border)",
            borderRadius: "var(--scout-radius)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(26,58,47,0.04)",
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
            }}
          >
            Intro matches for {clientLabel} — pooled network only, ranked by relationship strength.
          </div>

          {loading ? (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, padding: 12, margin: 0 }}>
              Loading cached matches…
            </p>
          ) : matches.length === 0 ? (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, padding: 12, margin: 0 }}>
              {readOnly
                ? "No cached matches yet."
                : "No matches yet — click Find intro matches after the client has tracked target companies and pooled inboxes are synced."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: T.bodySm }}>
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      color: color.muted,
                      fontFamily: fontMono,
                      fontSize: T.caption,
                      textTransform: "uppercase",
                    }}
                  >
                    <th style={{ padding: "10px 8px" }}>Contact</th>
                    <th style={{ padding: "10px 8px" }}>Company</th>
                    <th style={{ padding: "10px 8px" }}>Known by</th>
                    <th style={{ padding: "10px 8px" }}>Strength</th>
                    <th style={{ padding: "10px 8px" }}>Last activity</th>
                    <th style={{ padding: "10px 8px" }}>Open roles</th>
                    <th style={{ padding: "10px 8px" }}>Intro</th>
                    <th style={{ padding: "10px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {matches.map((row) => {
                    const tracking = row.introTracking;
                    const statusNote = introStatusLabel(tracking?.status);
                    const busy = trackingBusyId === row.contact.id;
                    return (
                      <tr key={row.id} style={{ borderTop: "var(--scout-border)" }}>
                        <td style={{ padding: "12px 8px" }}>
                          <div style={{ fontWeight: 600, color: color.ink }}>
                            {row.contact.name ?? row.contact.email}
                          </div>
                          {row.contact.title && (
                            <div style={{ fontSize: T.caption, color: color.muted }}>{row.contact.title}</div>
                          )}
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <div>{row.contact.company ?? row.targetCompany}</div>
                          {row.matchType && (
                            <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                              {row.matchType} match
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <div>{row.knownBy.name ?? "Member"}</div>
                          {row.knownBy.email && (
                            <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                              {row.knownBy.email}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <span style={{ color: strengthColor(row.strengthScore), fontWeight: 600 }}>
                            {strengthLabel(row.strengthScore)} ({row.strengthScore})
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px", color: color.muted }}>
                          {row.contact.lastActivityAt
                            ? new Date(row.contact.lastActivityAt).toLocaleDateString()
                            : row.knownBy.lastSeenAt
                              ? new Date(row.knownBy.lastSeenAt).toLocaleDateString()
                              : "—"}
                        </td>
                        <td style={{ padding: "12px 8px", color: color.muted }}>
                          {row.hasOpenRoles ? (
                            <span style={{ color: color.forest }}>
                              {row.hirebaseJobs.length} role{row.hirebaseJobs.length === 1 ? "" : "s"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "12px 8px", color: color.muted, fontSize: T.caption }}>
                          {statusNote ?? "—"}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {!readOnly && trackingApi && tracking?.status !== "SENT" && tracking?.status !== "DONE" && (
                              <ScoutSecondaryBtn
                                onClick={() =>
                                  void updateIntroTracking(row.contact.id, "SENT", tracking?.id)
                                }
                                disabled={busy}
                              >
                                {busy ? "Saving…" : "Mark intro sent"}
                              </ScoutSecondaryBtn>
                            )}
                            {!readOnly && trackingApi && tracking?.status === "SENT" && (
                              <ScoutSecondaryBtn
                                onClick={() =>
                                  void updateIntroTracking(row.contact.id, "DONE", tracking.id)
                                }
                                disabled={busy}
                              >
                                {busy ? "Saving…" : "Mark done"}
                              </ScoutSecondaryBtn>
                            )}
                            {!readOnly && (
                              <ScoutSecondaryBtn
                                onClick={() => void enrichContact(row.contact.id)}
                                disabled={enrichingId === row.contact.id}
                              >
                                {enrichingId === row.contact.id ? "Enriching…" : "Enrich with Sumble"}
                              </ScoutSecondaryBtn>
                            )}
                            {!readOnly && (
                              <Link
                                href={composeUrl(row.contact.email)}
                                style={{
                                  fontFamily: fontSans,
                                  fontSize: T.caption,
                                  color: color.forest,
                                  textDecoration: "underline",
                                  alignSelf: "center",
                                }}
                              >
                                Send email
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrgIntroMatchPriorityPanel({
  orgId,
  apiBase = `/api/admin/orgs/${orgId}`,
  clientLinkPrefix,
}: {
  orgId: string;
  apiBase?: string;
  clientLinkPrefix?: string;
}) {
  const [rows, setRows] = useState<
    Array<IntroMatchRow & { client: { id: string; email: string; name: string | null } }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBase}/intro-matches`);
        if (!res.ok) return;
        const data = (await res.json()) as { topMatches?: typeof rows };
        setRows(data.topMatches ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

  if (loading) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
        Loading top opportunities…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
        No intro matches yet — assign clients with target companies and run Find intro matches.
      </p>
    );
  }

  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone }}>
      {rows.slice(0, 8).map((row) => (
        <li key={row.id} style={{ marginBottom: 6 }}>
          {row.knownBy.name ?? "Member"} knows {row.contact.name ?? row.contact.email} @{" "}
          {row.contact.company ?? row.targetCompany} — strength {row.strengthScore}{" "}
          {clientLinkPrefix ? (
            <Link
              href={`${clientLinkPrefix}/${row.client.id}`}
              style={{ color: color.forest, textDecoration: "underline" }}
            >
              ({row.client.name ?? row.client.email})
            </Link>
          ) : (
            <span>({row.client.name ?? row.client.email})</span>
          )}
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

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

export function OrgClientIntroMatchesPanel({
  orgId,
  clientUserId,
  clientLabel,
}: {
  orgId: string;
  clientUserId: string;
  clientLabel: string;
}) {
  const [matches, setMatches] = useState<IntroMatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const loadCached = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/clients/${clientUserId}/intro-matches`);
      const data = (await res.json()) as { matches?: IntroMatchRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load intro matches.");
      setMatches(data.matches ?? []);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load intro matches."));
    } finally {
      setLoading(false);
    }
  }, [orgId, clientUserId]);

  useEffect(() => {
    if (expanded) void loadCached();
  }, [expanded, loadCached]);

  async function findMatches() {
    setFinding(true);
    setError(null);
    setExpanded(true);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/clients/${clientUserId}/intro-matches`, {
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
    setEnrichingId(contactId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/contacts/${contactId}/enrich`, {
        method: "POST",
      });
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

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <ScoutSecondaryBtn onClick={() => void findMatches()} disabled={finding}>
          {finding ? "Finding matches…" : "Find intro matches"}
        </ScoutSecondaryBtn>
        {matches.length > 0 && (
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
              No matches yet — click Find intro matches after the client has tracked target companies and pooled inboxes are synced.
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
                    <th style={{ padding: "10px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {matches.map((row) => (
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
                      <td style={{ padding: "12px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <ScoutSecondaryBtn
                            onClick={() => void enrichContact(row.contact.id)}
                            disabled={enrichingId === row.contact.id}
                          >
                            {enrichingId === row.contact.id ? "Enriching…" : "Enrich with Sumble"}
                          </ScoutSecondaryBtn>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrgIntroMatchPriorityPanel({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<
    Array<IntroMatchRow & { client: { id: string; email: string; name: string | null } }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/orgs/${orgId}/intro-matches`);
        if (!res.ok) return;
        const data = (await res.json()) as { topMatches?: typeof rows };
        setRows(data.topMatches ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  if (loading || rows.length === 0) return null;

  return (
    <div style={{ marginTop: 16, padding: 12, background: "rgba(26,58,47,0.04)", borderRadius: "var(--scout-radius)" }}>
      <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, textTransform: "uppercase" }}>
        Top intro matches (all clients)
      </div>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone }}>
        {rows.slice(0, 5).map((row) => (
          <li key={row.id}>
            {row.knownBy.name ?? "Member"} knows {row.contact.name ?? row.contact.email} @{" "}
            {row.contact.company ?? row.targetCompany} — strength {row.strengthScore} (
            {row.client.name ?? row.client.email})
          </li>
        ))}
      </ul>
    </div>
  );
}

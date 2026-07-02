"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { buildSenderAvatarUrls } from "@/lib/email-sender-display";
import type { OrgContactStrengthFactors } from "@/lib/org-contact-graph/types";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

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
    strengthFactors?: OrgContactStrengthFactors;
  };
  hirebaseJobs: Array<{ id: string; title: string; url: string | null }>;
  introTracking?: IntroTrackingRow | null;
};

function strengthLabel(score: number): string {
  if (score >= 70) return "Strong";
  if (score >= 40) return "Moderate";
  return "Weak";
}

function strengthColor(score: number): string {
  if (score >= 70) return color.forest;
  if (score >= 40) return "#78716c";
  return color.muted;
}

function strengthDotColor(score: number): string {
  if (score >= 70) return "#4A8B6A";
  if (score >= 40) return "#CA8A04";
  return "#A8A29E";
}

const BRUDDLE_INK = color.bruddleInk;

/** Bruddle pill — colored dot + Via owner or strength label (Contacts list pattern). */
function IntroMatchViaPill({
  ownerName,
  strengthScore,
  preferStrength = false,
}: {
  ownerName: string | null;
  strengthScore: number;
  preferStrength?: boolean;
}) {
  const dotColor = strengthDotColor(strengthScore);
  const label =
    !preferStrength && ownerName?.trim()
      ? `Via ${ownerName.trim()}`
      : strengthLabel(strengthScore);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "4px 10px 4px 8px",
        borderRadius: 0,
        border: `1.5px solid ${BRUDDLE_INK}`,
        background: `${dotColor}18`,
        color: BRUDDLE_INK,
        fontFamily: fontSans,
        fontSize: T.caption,
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
        maxWidth: 160,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </span>
  );
}

function IntroMatchListRow({
  row,
  expanded,
  isLast = false,
  onToggleExpand,
  copiedEmail,
  onCopyEmail,
  readOnly,
  trackingApi,
  trackingBusy,
  enriching,
  onEnrich,
  onUpdateTracking,
}: {
  row: IntroMatchRow;
  expanded: boolean;
  onToggleExpand: () => void;
  copiedEmail: string | null;
  onCopyEmail: (email: string) => void;
  readOnly: boolean;
  trackingApi: string | null;
  trackingBusy: boolean;
  enriching: boolean;
  onEnrich: () => void;
  onUpdateTracking: (status: IntroTrackingRow["status"], existingId?: string) => void;
}) {
  const displayName = row.contact.name ?? row.contact.email;
  const avatar = buildSenderAvatarUrls(displayName, row.contact.email);
  const company = row.contact.company ?? row.targetCompany;
  const tracking = row.introTracking;
  const statusNote = introStatusLabel(tracking?.status);

  return (
    <div style={{ borderBottom: isLast ? undefined : border.line }}>
      <button
        type="button"
        onClick={onToggleExpand}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          textAlign: "left",
          padding: "14px 16px",
          border: "none",
          background: expanded ? "rgba(26,58,47,0.03)" : surface.card,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: avatar.primary || avatar.fallback ? "#fff" : undefined,
            border: avatar.primary || avatar.fallback ? "1px solid rgba(0,0,0,0.06)" : undefined,
          }}
        >
          {avatar.primary || avatar.fallback ? (
            <img
              src={avatar.primary ?? avatar.fallback ?? undefined}
              alt=""
              width={34}
              height={34}
              style={{ objectFit: "cover", borderRadius: "50%" }}
            />
          ) : (
            <span
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: color.forest,
                color: color.gold,
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {avatar.initials}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink }}>
            {displayName}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.muted,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.contact.email}
          </p>
          {company && (
            <p
              style={{
                margin: "2px 0 0",
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.stone,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {company}
              {row.matchType ? ` · ${matchTypeLabel(row.matchType)}` : ""}
            </p>
          )}
        </div>
        <IntroMatchViaPill ownerName={row.knownBy.name} strengthScore={row.strengthScore} />
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 14px", background: "rgba(26,58,47,0.03)" }}>
          <WhyThisMatchPanel row={row} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <ScoutSecondaryBtn onClick={() => onCopyEmail(row.contact.email)}>
              {copiedEmail === row.contact.email ? "Copied" : "Copy email"}
            </ScoutSecondaryBtn>
            {!readOnly && trackingApi && tracking?.status !== "SENT" && tracking?.status !== "DONE" && (
              <ScoutSecondaryBtn
                onClick={() => onUpdateTracking("SENT", tracking?.id)}
                disabled={trackingBusy}
              >
                {trackingBusy ? "Saving…" : "Mark intro sent"}
              </ScoutSecondaryBtn>
            )}
            {!readOnly && trackingApi && tracking?.status === "SENT" && (
              <ScoutSecondaryBtn
                onClick={() => onUpdateTracking("DONE", tracking.id)}
                disabled={trackingBusy}
              >
                {trackingBusy ? "Saving…" : "Mark done"}
              </ScoutSecondaryBtn>
            )}
            {!readOnly && (
              <ScoutSecondaryBtn onClick={onEnrich} disabled={enriching}>
                {enriching ? "Enriching…" : "Enrich with Sumble"}
              </ScoutSecondaryBtn>
            )}
          </div>
          {(statusNote || row.hasOpenRoles) && (
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "10px 0 0" }}>
              {statusNote && <span>{statusNote}</span>}
              {statusNote && row.hasOpenRoles && " · "}
              {row.hasOpenRoles && (
                <span style={{ color: color.forest }}>
                  Open role: {row.hirebaseJobs[0]?.title ?? "Yes"}
                  {row.hirebaseJobs.length > 1 ? ` (+${row.hirebaseJobs.length - 1} more)` : ""}
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function matchTypeLabel(matchType: string | null): string {
  if (matchType === "exact") return "Exact company name";
  if (matchType === "domain") return "Email domain match";
  if (matchType === "fuzzy") return "Similar company name";
  return "Company match";
}

function formatActivityDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function introStatusLabel(status: IntroTrackingRow["status"] | undefined): string | null {
  if (!status || status === "REQUESTED") return null;
  if (status === "SENT") return "Intro sent";
  if (status === "DONE") return "Done";
  if (status === "DECLINED") return "Declined";
  return null;
}

function WhyThisMatchPanel({ row }: { row: IntroMatchRow }) {
  const factors = row.knownBy.strengthFactors;
  const knownByName = row.knownBy.name ?? "You";
  const contactName = row.contact.name ?? row.contact.email;
  const company = row.contact.company ?? row.targetCompany;
  const lastActivity =
    row.contact.lastActivityAt ?? row.knownBy.lastSeenAt ?? factors?.lastEmailAt ?? factors?.lastMeetingAt;

  return (
    <div
      style={{
        marginTop: 8,
        padding: "10px 12px",
        background: "rgba(26,58,47,0.03)",
        borderRadius: "var(--scout-radius)",
        fontFamily: fontSans,
        fontSize: T.caption,
        color: color.stone,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 600, color: color.ink, marginBottom: 6 }}>Why this match</div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        <li>
          {knownByName} knows {contactName} at {company}
        </li>
        <li>
          Relationship: {strengthLabel(row.strengthScore)} ({row.strengthScore})
          {factors && (factors.emailCount > 0 || factors.meetingCount > 0) && (
            <>
              {" "}
              · {factors.emailCount} email{factors.emailCount === 1 ? "" : "s"}, {factors.meetingCount} meeting
              {factors.meetingCount === 1 ? "" : "s"}
            </>
          )}
        </li>
        <li>Last contact: {formatActivityDate(lastActivity)}</li>
        <li>
          Match: {matchTypeLabel(row.matchType)} → target {row.targetCompany}
        </li>
        {row.hasOpenRoles && row.hirebaseJobs.length > 0 && (
          <li style={{ color: color.forest }}>
            Open role: {row.hirebaseJobs[0]?.title}
            {row.hirebaseJobs.length > 1 ? ` (+${row.hirebaseJobs.length - 1} more)` : ""}
          </li>
        )}
      </ul>
    </div>
  );
}

async function copyEmail(email: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(email);
    return true;
  } catch {
    return false;
  }
}

export function OrgClientIntroMatchesPanel({
  orgId,
  clientUserId,
  clientLabel,
  apiBase = `/api/admin/orgs/${orgId}`,
  readOnly = false,
  defaultExpanded = false,
  targetCompanyCount,
  layout = "table",
}: {
  orgId: string;
  clientUserId: string;
  clientLabel: string;
  apiBase?: string;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  targetCompanyCount?: number;
  layout?: "table" | "list";
}) {
  const [matches, setMatches] = useState<IntroMatchRow[]>([]);
  const [loading, setLoading] = useState(defaultExpanded);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [trackingBusyId, setTrackingBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedWhyId, setExpandedWhyId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const matchesApi = `${apiBase}/clients/${clientUserId}/intro-matches`;
  const enrichApiBase = apiBase.includes("/api/org/")
    ? `/api/org/${orgId}/contacts`
    : `/api/admin/orgs/${orgId}/contacts`;
  const trackingApi = apiBase.includes("/api/org/")
    ? `/api/org/${orgId}/intro-tracking`
    : null;

  const hasTargets = targetCompanyCount == null || targetCompanyCount > 0;

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
    if (!hasTargets) {
      setError("Add target employers for this employee before finding intro matches.");
      return;
    }
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

  async function handleCopyEmail(email: string) {
    const ok = await copyEmail(email);
    if (ok) {
      setCopiedEmail(email);
      window.setTimeout(() => setCopiedEmail((current) => (current === email ? null : current)), 2000);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {!readOnly && (
          <ScoutSecondaryBtn onClick={() => void findMatches()} disabled={finding || !hasTargets}>
            {finding ? "Finding matches…" : "Find intro matches"}
          </ScoutSecondaryBtn>
        )}
        {!readOnly && !hasTargets && (
          <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
            Add target employers first.
          </span>
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
          style={
            layout === "list"
              ? {
                  marginTop: 12,
                  border: `1.5px solid ${BRUDDLE_INK}`,
                  borderRadius: "var(--scout-radius)",
                  overflow: "hidden",
                  background: surface.card,
                }
              : {
                  marginTop: 12,
                  border: "var(--scout-border)",
                  borderRadius: "var(--scout-radius)",
                  overflow: "hidden",
                }
          }
        >
          {layout === "table" && (
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
          )}

          {loading ? (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, padding: 12, margin: 0 }}>
              Loading cached matches…
            </p>
          ) : matches.length === 0 ? (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, padding: 12, margin: 0 }}>
              {readOnly
                ? "No cached matches yet."
                : hasTargets
                  ? "No matches yet — click Find intro matches after the pooled inbox is synced."
                  : "No target employers yet — add companies above, then find intro matches."}
            </p>
          ) : layout === "list" ? (
            <div>
              {matches.map((row, index) => {
                const whyOpen = expandedWhyId === row.id;
                const busy = trackingBusyId === row.contact.id;
                return (
                  <IntroMatchListRow
                    key={row.id}
                    row={row}
                    expanded={whyOpen}
                    isLast={index === matches.length - 1}
                    onToggleExpand={() => setExpandedWhyId((id) => (id === row.id ? null : row.id))}
                    copiedEmail={copiedEmail}
                    onCopyEmail={(email) => void handleCopyEmail(email)}
                    readOnly={readOnly}
                    trackingApi={trackingApi}
                    trackingBusy={busy}
                    enriching={enrichingId === row.contact.id}
                    onEnrich={() => void enrichContact(row.contact.id)}
                    onUpdateTracking={(status, existingId) =>
                      void updateIntroTracking(row.contact.id, status, existingId)
                    }
                  />
                );
              })}
            </div>
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
                    const whyOpen = expandedWhyId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr key={row.id} style={{ borderTop: "var(--scout-border)" }}>
                          <td style={{ padding: "12px 8px" }}>
                            <div style={{ fontWeight: 600, color: color.ink }}>
                              {row.contact.name ?? row.contact.email}
                            </div>
                            {row.contact.title && (
                              <div style={{ fontSize: T.caption, color: color.muted }}>{row.contact.title}</div>
                            )}
                            {row.contact.linkedinUrl && (
                              <a
                                href={row.contact.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: T.caption, color: color.forest }}
                              >
                                LinkedIn
                              </a>
                            )}
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <div>{row.contact.company ?? row.targetCompany}</div>
                            {row.matchType && (
                              <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                                {matchTypeLabel(row.matchType)}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <div>{row.knownBy.name ?? "Member"}</div>
                          </td>
                          <td style={{ padding: "12px 8px" }}>
                            <span style={{ color: strengthColor(row.strengthScore), fontWeight: 600 }}>
                              {strengthLabel(row.strengthScore)}
                            </span>
                          </td>
                          <td style={{ padding: "12px 8px", color: color.muted }}>
                            {row.hasOpenRoles ? (
                              <span style={{ color: color.forest }} title={row.hirebaseJobs[0]?.title}>
                                {row.hirebaseJobs[0]?.title ?? "Open role"}
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
                              <ScoutSecondaryBtn
                                onClick={() => setExpandedWhyId((id) => (id === row.id ? null : row.id))}
                              >
                                {whyOpen ? "Hide why" : "Why?"}
                              </ScoutSecondaryBtn>
                              <ScoutSecondaryBtn onClick={() => void handleCopyEmail(row.contact.email)}>
                                {copiedEmail === row.contact.email ? "Copied" : "Copy email"}
                              </ScoutSecondaryBtn>
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
                            </div>
                          </td>
                        </tr>
                        {whyOpen && (
                          <tr key={`${row.id}-why`}>
                            <td colSpan={7} style={{ padding: "0 8px 12px" }}>
                              <WhyThisMatchPanel row={row} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
        No intro matches yet — assign employees with target employers and run Find intro matches.
      </p>
    );
  }

  return (
    <ul style={{ margin: 0, paddingLeft: 18, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone }}>
      {rows.slice(0, 8).map((row) => (
        <li key={row.id} style={{ marginBottom: 6 }}>
          {row.knownBy.name ?? "Member"} knows {row.contact.name ?? row.contact.email} @{" "}
          {row.contact.company ?? row.targetCompany} — {strengthLabel(row.strengthScore)}{" "}
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

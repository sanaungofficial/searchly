"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { PipelineTag } from "@/components/scout/pipeline-tag";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import type {
  OrgPotentialConnectionContact,
  OrgPotentialConnectionKnownBy,
  OrgTargetPotentialConnections,
} from "@/lib/org-network-match";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

const line = "var(--scout-border)";

const compactBtnStyle: React.CSSProperties = {
  padding: "6px 10px",
  minHeight: 32,
  fontSize: T.caption,
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 700,
  color: color.muted,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  borderBottom: line,
  background: "var(--bruddle-surface, #FAF4F0)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "top",
  borderBottom: line,
  fontFamily: fontSans,
  fontSize: T.bodySm,
  color: color.ink,
};

async function copyEmail(email: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(email);
    return true;
  } catch {
    return false;
  }
}

function matchTypeLabel(matchType: OrgPotentialConnectionContact["matchType"]): string {
  if (matchType === "exact") return "Exact company";
  if (matchType === "domain") return "Domain match";
  return "Similar name";
}

function matchTagColor(matchType: OrgPotentialConnectionContact["matchType"]) {
  if (matchType === "exact") return "green" as const;
  if (matchType === "domain") return "purple" as const;
  return "gray" as const;
}

function formatTargetDomain(website: string | null): string | null {
  if (!website) return null;
  return website.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

function ConnectionOwnerCell({ knownBy }: { knownBy: OrgPotentialConnectionKnownBy }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {knownBy.isViewer && (
          <PipelineTag label="You" color="purple" variant="light" compact />
        )}
        <span style={{ fontWeight: 600 }}>{knownBy.memberFullName}</span>
      </div>
      {knownBy.memberEmail && (
        <div
          style={{
            marginTop: 2,
            fontFamily: fontMono,
            fontSize: T.caption,
            color: color.muted,
            wordBreak: "break-all",
          }}
        >
          {knownBy.memberEmail}
        </div>
      )}
      <div style={{ marginTop: 2, fontSize: T.caption, color: color.stone }}>{knownBy.orgName}</div>
    </div>
  );
}

function ContactActionsRow({
  contact,
  copiedEmail,
  onCopyEmail,
}: {
  contact: OrgPotentialConnectionContact;
  copiedEmail: string | null;
  onCopyEmail: (email: string) => void;
}) {
  const ownerLabel = contact.knownBy.isViewer
    ? "owner"
    : contact.knownBy.memberFullName.split(/\s+/)[0] ?? contact.knownBy.memberFullName;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <ScoutSecondaryBtn style={compactBtnStyle} onClick={() => onCopyEmail(contact.email)}>
        {copiedEmail === contact.email ? "Copied" : "Copy email"}
      </ScoutSecondaryBtn>
      <ScoutSecondaryBtn
        style={compactBtnStyle}
        onClick={() => {
          window.location.href = `mailto:${encodeURIComponent(contact.email)}`;
        }}
      >
        Email contact
      </ScoutSecondaryBtn>
      {contact.knownBy.memberEmail && (
        <ScoutSecondaryBtn
          style={compactBtnStyle}
          onClick={() => {
            window.location.href = `mailto:${encodeURIComponent(contact.knownBy.memberEmail!)}`;
          }}
        >
          Contact {ownerLabel}
        </ScoutSecondaryBtn>
      )}
    </div>
  );
}

function PotentialConnectionsTable({
  targets,
  orgName,
  copiedEmail,
  onCopyEmail,
}: {
  targets: OrgTargetPotentialConnections[];
  orgName: string | null;
  copiedEmail: string | null;
  onCopyEmail: (email: string) => void;
}) {
  const totalContacts = useMemo(
    () => targets.reduce((sum, target) => sum + target.totalContacts, 0),
    [targets],
  );

  return (
    <div className="bruddle">
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 10px" }}>
        {totalContacts} pooled contact{totalContacts === 1 ? "" : "s"} across {targets.length} target compan
        {targets.length === 1 ? "y" : "ies"}
        {orgName ? ` · ${orgName}` : ""}. Rows show every org member who knows someone at a target company —
        your connections are labeled <strong>You</strong>.
      </p>
      <div style={{ overflowX: "auto", border: line, background: "var(--scout-surface, #fff)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={thStyle}>Contact</th>
              <th style={thStyle}>Company</th>
              <th style={thStyle}>Match</th>
              <th style={thStyle}>Connection owner</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => {
              const domain = formatTargetDomain(target.targetWebsite);
              return target.contacts.map((contact, index) => {
                const displayName = contact.name ?? contact.email;
                const isFirstInGroup = index === 0;
                return (
                  <tr key={`${target.targetCompanyId}-${contact.id}`}>
                    <td style={tdStyle}>
                      {isFirstInGroup && (
                        <div style={{ marginBottom: 6 }}>
                          <PipelineTag
                            label={target.targetCompany}
                            color="green"
                            variant="light"
                            compact
                          />
                          {domain && (
                            <div
                              style={{
                                marginTop: 4,
                                fontFamily: fontMono,
                                fontSize: T.caption,
                                color: color.muted,
                              }}
                            >
                              {domain}
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ fontWeight: 600 }}>{displayName}</div>
                      <div
                        style={{
                          marginTop: 2,
                          fontFamily: fontMono,
                          fontSize: T.caption,
                          color: color.muted,
                          wordBreak: "break-all",
                        }}
                      >
                        {contact.email}
                      </div>
                      {contact.title && (
                        <div style={{ marginTop: 2, fontSize: T.caption, color: color.stone }}>
                          {contact.title}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>{contact.company ?? target.targetCompany}</td>
                    <td style={tdStyle}>
                      <PipelineTag
                        label={matchTypeLabel(contact.matchType)}
                        color={matchTagColor(contact.matchType)}
                        variant="light"
                        compact
                      />
                    </td>
                    <td style={tdStyle}>
                      <ConnectionOwnerCell knownBy={contact.knownBy} />
                    </td>
                    <td style={tdStyle}>
                      <ContactActionsRow
                        contact={contact}
                        copiedEmail={copiedEmail}
                        onCopyEmail={onCopyEmail}
                      />
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OrgEmployeePotentialConnectionsSection({
  orgId,
  userId,
  targetCount,
}: {
  orgId: string;
  userId: string;
  targetCount?: number;
}) {
  const [targets, setTargets] = useState<OrgTargetPotentialConnections[]>([]);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const hasTargets = targetCount == null || targetCount > 0;
  const apiBase = `/api/org/${orgId}/employees/${userId}/potential-connections`;

  const load = useCallback(async () => {
    if (!hasTargets) {
      setTargets([]);
      setOrgName(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase);
      const data = (await res.json()) as {
        targets?: OrgTargetPotentialConnections[];
        orgName?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load potential connections.");
      setTargets(data.targets ?? []);
      setOrgName(data.orgName ?? null);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load potential connections."));
    } finally {
      setLoading(false);
    }
  }, [apiBase, hasTargets, targetCount]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCopyEmail(email: string) {
    const ok = await copyEmail(email);
    if (ok) {
      setCopiedEmail(email);
      window.setTimeout(() => setCopiedEmail((current) => (current === email ? null : current)), 2000);
    }
  }

  if (!hasTargets) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
        Add target employers above to see who in your org knows people at those companies.
      </p>
    );
  }

  if (loading) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
        Scanning pooled network by company domain…
      </p>
    );
  }

  if (error) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: 0 }}>{error}</p>
    );
  }

  if (targets.length === 0) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
        No connections at target companies yet.
      </p>
    );
  }

  return (
    <PotentialConnectionsTable
      targets={targets}
      orgName={orgName}
      copiedEmail={copiedEmail}
      onCopyEmail={(email) => void handleCopyEmail(email)}
    />
  );
}
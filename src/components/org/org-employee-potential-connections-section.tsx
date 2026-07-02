"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import type {
  OrgPotentialConnectionContact,
  OrgTargetPotentialConnections,
} from "@/lib/org-network-match";
import { formatPotentialConnectionOwnersSummary } from "@/lib/org-network-match";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

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

function TargetConnectionRow({
  target,
  expanded,
  onToggle,
  copiedEmail,
  onCopyEmail,
}: {
  target: OrgTargetPotentialConnections;
  expanded: boolean;
  onToggle: () => void;
  copiedEmail: string | null;
  onCopyEmail: (email: string) => void;
}) {
  const summary = formatPotentialConnectionOwnersSummary(target.owners);

  return (
    <div style={{ borderTop: border.line }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          width: "100%",
          textAlign: "left",
          padding: "12px 14px",
          border: "none",
          background: expanded ? "rgba(26,58,47,0.03)" : surface.card,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 10px",
            borderRadius: "var(--scout-radius)",
            border: "1px solid rgba(74,139,106,0.35)",
            background: "rgba(74,139,106,0.12)",
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            color: color.forest,
            flexShrink: 0,
            maxWidth: 180,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {target.targetCompany}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.ink }}>
            {summary}
          </p>
          {target.targetWebsite && (
            <p
              style={{
                margin: "4px 0 0",
                fontFamily: fontMono,
                fontSize: T.caption,
                color: color.muted,
              }}
            >
              {target.targetWebsite.replace(/^https?:\/\//, "").replace(/^www\./, "")}
            </p>
          )}
        </div>
        <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, flexShrink: 0 }}>
          {expanded ? "Hide" : `${target.totalContacts}`}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 12px", background: "rgba(26,58,47,0.03)" }}>
          {target.contacts.map((contact) => {
            const displayName = contact.name ?? contact.email;
            return (
              <div
                key={contact.id}
                style={{
                  padding: "10px 0",
                  borderTop: border.line,
                }}
              >
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                  {displayName}
                </p>
                <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                  {contact.email}
                  {contact.company ? ` · ${contact.company}` : ""}
                  {contact.title ? ` · ${contact.title}` : ""}
                </p>
                <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                  Known via {contact.knownBy.name} · {matchTypeLabel(contact.matchType)}
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  <ScoutSecondaryBtn onClick={() => onCopyEmail(contact.email)}>
                    {copiedEmail === contact.email ? "Copied" : "Copy email"}
                  </ScoutSecondaryBtn>
                  <a
                    href={`mailto:${encodeURIComponent(contact.email)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "8px 12px",
                      border: border.line,
                      borderRadius: "var(--scout-radius)",
                      background: surface.card,
                      fontFamily: fontSans,
                      fontSize: T.caption,
                      fontWeight: 600,
                      color: color.ink,
                      textDecoration: "none",
                    }}
                  >
                    Email contact
                  </a>
                  {contact.knownBy.email && (
                    <a
                      href={`mailto:${encodeURIComponent(contact.knownBy.email)}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "8px 12px",
                        border: border.line,
                        borderRadius: "var(--scout-radius)",
                        background: surface.card,
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        fontWeight: 600,
                        color: color.stone,
                        textDecoration: "none",
                      }}
                    >
                      Contact {contact.knownBy.name.split(/\s+/)[0] ?? contact.knownBy.name}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const hasTargets = targetCount == null || targetCount > 0;
  const apiBase = `/api/org/${orgId}/employees/${userId}/potential-connections`;

  const load = useCallback(async () => {
    if (!hasTargets) {
      setTargets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase);
      const data = (await res.json()) as { targets?: OrgTargetPotentialConnections[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load potential connections.");
      setTargets(data.targets ?? []);
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
    <div>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 10px" }}>
        {targets.length} target compan{targets.length === 1 ? "y has" : "ies have"} pooled contacts — expand a row to reach out.
      </p>
      <div
        style={{
          border: border.line,
          borderRadius: "var(--scout-radius)",
          overflow: "hidden",
          background: surface.card,
        }}
      >
        {targets.map((target) => (
          <TargetConnectionRow
            key={target.targetCompanyId}
            target={target}
            expanded={expandedId === target.targetCompanyId}
            onToggle={() =>
              setExpandedId((current) => (current === target.targetCompanyId ? null : target.targetCompanyId))
            }
            copiedEmail={copiedEmail}
            onCopyEmail={(email) => void handleCopyEmail(email)}
          />
        ))}
      </div>
    </div>
  );
}

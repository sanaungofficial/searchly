"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { OrgIntroMatchPriorityPanel } from "@/components/admin/org-client-intro-matches-section";
import { OrgSettingsNav } from "@/components/org/org-settings-nav";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, displayTitleStyle, fontMono, fontSans, type as T } from "@/lib/typography";

type DashboardClient = {
  userId: string;
  email: string;
  name: string | null;
  profileComplete: boolean;
  profileCompletenessPct: number;
  hasMatches: boolean;
  matchCount: number;
  introsPending: number;
  targetCompanyCount: number;
};

type OnboardingChecklist = {
  emailConnected: boolean;
  employeesAdded: boolean;
  targetsSet: boolean;
  introPathsFound: boolean;
};

type DashboardData = {
  org: { id: string; name: string; slug: string };
  clients: DashboardClient[];
  networkCoverage: { sharingCount: number; memberCount: number; pooledContactCount: number };
  onboarding: OnboardingChecklist;
  isOrgAdmin: boolean;
};

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: fontMono,
        fontSize: T.caption,
        padding: "2px 8px",
        borderRadius: 999,
        background: ok ? "rgba(74,139,106,0.12)" : "rgba(160,152,144,0.12)",
        color: ok ? color.forest : color.muted,
      }}
    >
      {label}
    </span>
  );
}

function ChecklistStep({
  done,
  label,
  href,
}: {
  done: boolean;
  label: string;
  href: string;
}) {
  return (
    <li style={{ marginBottom: 8 }}>
      <Link
        href={href}
        style={{
          fontFamily: fontSans,
          fontSize: T.bodySm,
          color: done ? color.forest : color.stone,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontFamily: fontMono, fontSize: T.caption }}>{done ? "✓" : "○"}</span>
        <span style={{ textDecoration: "underline" }}>{label}</span>
      </Link>
    </li>
  );
}

export function OrgDashboardPanel({ orgId }: { orgId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/${orgId}/dashboard`);
      const json = (await res.json()) as DashboardData & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not load org dashboard.");
      setData(json);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load org dashboard."));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Loading organization dashboard…</p>
    );
  }

  if (error || !data) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A" }}>
        {error ?? "Could not load dashboard."}
      </p>
    );
  }

  const apiBase = `/api/org/${orgId}`;
  const firstEmployeeId = data.clients[0]?.userId;
  const targetsHref = firstEmployeeId
    ? `/org/${orgId}/clients/${firstEmployeeId}`
    : `/org/${orgId}/settings/clients`;
  const introHref = firstEmployeeId
    ? `/org/${orgId}/clients/${firstEmployeeId}`
    : `/org/${orgId}/dashboard`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
      <div>
        <Link href="/dashboard" style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "none" }}>
          ← Personal dashboard
        </Link>
        <h1 style={{ ...displayTitleStyle(28), margin: "12px 0 8px" }}>{data.org.name}</h1>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          {data.isOrgAdmin
            ? "Outplacement home — connect your inbox, manage employees, and find warm intro paths through your pooled network."
            : "Search the organization's pooled contacts and view intro opportunities."}
        </p>
        <OrgSettingsNav orgId={orgId} active="dashboard" isOrgAdmin={data.isOrgAdmin} />
      </div>

      {data.isOrgAdmin && (
        <ScoutBox padding={20}>
          <ScoutLabel>Getting started</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 12px" }}>
            Connect your email as a pooled inbox (v1: org owner contributes the network), then add employees and their target employers.
          </p>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
            <ChecklistStep
              done={data.onboarding.emailConnected}
              label="Connect email (pooled inbox)"
              href={`/org/${orgId}/settings/network`}
            />
            <ChecklistStep
              done={data.onboarding.employeesAdded}
              label="Add employees"
              href={`/org/${orgId}/settings/clients`}
            />
            <ChecklistStep
              done={data.onboarding.targetsSet}
              label="Set target employers"
              href={targetsHref}
            />
            <ChecklistStep
              done={data.onboarding.introPathsFound}
              label="Find intro paths"
              href={introHref}
            />
          </ul>
        </ScoutBox>
      )}

      <ScoutBox padding={20}>
        <ScoutLabel>Pooled network</ScoutLabel>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, margin: "12px 0 0" }}>
          <strong>{data.networkCoverage.pooledContactCount.toLocaleString()}</strong> contacts in pooled inbox
          {data.isOrgAdmin && (
            <>
              {" "}
              · <strong>{data.networkCoverage.sharingCount}</strong> of{" "}
              <strong>{data.networkCoverage.memberCount}</strong> members contributing
            </>
          )}
        </p>
        <Link
          href={`/org/${orgId}/settings/network`}
          style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, textDecoration: "underline" }}
        >
          Network settings →
        </Link>
      </ScoutBox>

      {data.isOrgAdmin && (
        <ScoutBox padding={20}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <ScoutLabel>Assigned employees</ScoutLabel>
            <Link
              href={`/org/${orgId}/settings/clients`}
              style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, textDecoration: "underline" }}
            >
              Manage employees →
            </Link>
          </div>

          {data.clients.length === 0 ? (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "12px 0 0" }}>
              No employees assigned yet. Add employees from Employee settings.
            </p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: T.bodySm }}>
                <thead>
                  <tr style={{ textAlign: "left", color: color.muted, fontFamily: fontMono, fontSize: T.caption, textTransform: "uppercase" }}>
                    <th style={{ padding: "10px 8px" }}>Employee</th>
                    <th style={{ padding: "10px 8px" }}>Status</th>
                    <th style={{ padding: "10px 8px" }}>Targets</th>
                    <th style={{ padding: "10px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {data.clients.map((client) => (
                    <tr key={client.userId} style={{ borderTop: "var(--scout-border)" }}>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ fontWeight: 600, color: color.ink }}>{client.name ?? client.email}</div>
                        {client.name && (
                          <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>{client.email}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <StatusChip
                            ok={client.profileComplete}
                            label={client.profileComplete ? "Profile ready" : `Profile ${client.profileCompletenessPct}%`}
                          />
                          <StatusChip ok={client.hasMatches} label={client.hasMatches ? `${client.matchCount} matches` : "No matches"} />
                          {client.introsPending > 0 && (
                            <StatusChip ok={false} label={`${client.introsPending} intro${client.introsPending === 1 ? "" : "s"} pending`} />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px", color: color.muted }}>
                        {client.targetCompanyCount} compan{client.targetCompanyCount === 1 ? "y" : "ies"}
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right" }}>
                        <Link
                          href={`/org/${orgId}/clients/${client.userId}`}
                          style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, textDecoration: "underline" }}
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScoutBox>
      )}

      <ScoutBox padding={20}>
        <ScoutLabel>Top opportunities this week</ScoutLabel>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 12px" }}>
          Cross-employee intro queue ranked by relationship strength.
        </p>
        <OrgIntroMatchPriorityPanel
          orgId={orgId}
          apiBase={apiBase}
          clientLinkPrefix={`/org/${orgId}/clients`}
        />
      </ScoutBox>

      <ScoutBox padding={20}>
        <ScoutLabel>Quick links</ScoutLabel>
        <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontFamily: fontSans, fontSize: T.bodySm, color: color.stone }}>
          {data.isOrgAdmin && (
            <li>
              <Link href={`/org/${orgId}/settings/clients`} style={{ color: color.forest }}>
                Employee settings
              </Link>
            </li>
          )}
          <li>
            <Link href={`/org/${orgId}/settings/network`} style={{ color: color.forest }}>
              Network settings
            </Link>
          </li>
          <li>
            <Link href={`/org/${orgId}/contacts`} style={{ color: color.forest }}>
              Pooled contact search
            </Link>
          </li>
        </ul>
      </ScoutBox>
    </div>
  );
}

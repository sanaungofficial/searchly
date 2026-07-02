"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { CreateClientModal } from "@/components/admin/create-client-modal";
import { OrgIntroMatchPriorityPanel } from "@/components/admin/org-client-intro-matches-section";
import {
  EmployeeIntroDrawer,
  type EmployeeDrawerClient,
  type EmployeeDrawerTeamMember,
} from "@/components/org/employee-intro-drawer";
import { EmployeeViewAsActions } from "@/components/org/employee-view-as-actions";
import { EmployeeIntroMatchPreviewStack } from "@/components/org/employee-intro-match-preview-stack";
import { useWorkspace } from "@/contexts/workspace-context";
import { useEmployeeViewAs } from "@/hooks/use-employee-view-as";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type TeamMemberRow = {
  orgMemberId: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
  user: { id: string; email: string; name: string | null };
  source: {
    id: string;
    visibility: "PRIVATE" | "POOLED";
    status: "ACTIVE" | "DISCONNECTED" | "ERROR";
    email: string | null;
    provider: string | null;
    connectedAt: string | null;
    lastSyncAt: string | null;
    syncedContactCount?: number;
  } | null;
};

type SupportedClientRow = EmployeeDrawerClient & {
  assignmentId: string;
};

type UnifiedEmployeeRow = {
  userId: string;
  email: string;
  name: string | null;
  isTeamMember: boolean;
  isSupported: boolean;
  orgMemberId?: string;
  orgRole?: "ADMIN" | "MEMBER";
  joinedAt?: string;
  source?: TeamMemberRow["source"];
  assignmentId?: string;
  assignedAt?: string;
  notes?: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "var(--scout-border)",
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: T.bodySm,
  boxSizing: "border-box",
  background: surface.card,
  color: color.ink,
};

const STATUS_STYLE: Record<NonNullable<TeamMemberRow["source"]>["status"], { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: "rgba(26,58,47,0.1)", color: color.forest, label: "Connected" },
  DISCONNECTED: { bg: "rgba(160,152,144,0.12)", color: "#78716c", label: "Not connected" },
  ERROR: { bg: "rgba(196,87,74,0.12)", color: "#C4574A", label: "Error" },
};

const VISIBILITY_STYLE: Record<"PRIVATE" | "POOLED", { bg: string; color: string; label: string }> = {
  PRIVATE: { bg: "rgba(160,152,144,0.12)", color: "#78716c", label: "Private" },
  POOLED: { bg: "rgba(26,58,47,0.1)", color: color.forest, label: "Pooled" },
};

const BADGE_BASE: React.CSSProperties = {
  fontFamily: fontMono,
  fontSize: T.caption,
  padding: "2px 7px",
  borderRadius: "var(--scout-radius)",
  display: "inline-block",
};

function mergeEmployees(members: TeamMemberRow[], clients: SupportedClientRow[]): UnifiedEmployeeRow[] {
  const byUserId = new Map<string, UnifiedEmployeeRow>();

  for (const member of members) {
    byUserId.set(member.user.id, {
      userId: member.user.id,
      email: member.user.email,
      name: member.user.name,
      isTeamMember: true,
      isSupported: false,
      orgMemberId: member.orgMemberId,
      orgRole: member.role,
      joinedAt: member.joinedAt,
      source: member.source,
    });
  }

  for (const client of clients) {
    const existing = byUserId.get(client.userId);
    if (existing) {
      existing.isSupported = true;
      existing.assignmentId = client.assignmentId;
      existing.assignedAt = client.assignedAt;
      existing.notes = client.notes;
      if (!existing.name && client.name) existing.name = client.name;
    } else {
      byUserId.set(client.userId, {
        userId: client.userId,
        email: client.email,
        name: client.name,
        isTeamMember: false,
        isSupported: true,
        assignmentId: client.assignmentId,
        assignedAt: client.assignedAt,
        notes: client.notes,
      });
    }
  }

  return Array.from(byUserId.values()).sort((a, b) => {
    const nameA = (a.name ?? a.email).toLowerCase();
    const nameB = (b.name ?? b.email).toLowerCase();
    return nameA.localeCompare(nameB);
  });
}

function toDrawerClient(row: UnifiedEmployeeRow): EmployeeDrawerClient | null {
  if (!row.isSupported || !row.assignedAt) return null;
  return {
    userId: row.userId,
    email: row.email,
    name: row.name,
    assignedAt: row.assignedAt,
    notes: row.notes ?? null,
  };
}

function toDrawerTeamMember(row: UnifiedEmployeeRow): EmployeeDrawerTeamMember | null {
  if (!row.isTeamMember || !row.orgMemberId || !row.joinedAt) return null;
  return {
    orgMemberId: row.orgMemberId,
    role: row.orgRole ?? "MEMBER",
    joinedAt: row.joinedAt,
    source: row.source ?? null,
  };
}

function RoleBadges({ row }: { row: UnifiedEmployeeRow }) {
  const badges: { label: string; bg: string; fg: string }[] = [];

  if (row.isTeamMember && row.orgRole === "ADMIN") {
    badges.push({ label: "Admin", bg: "rgba(26,58,47,0.12)", fg: color.forest });
  } else if (row.isTeamMember && row.orgRole === "MEMBER") {
    badges.push({ label: "Member", bg: "rgba(160,152,144,0.12)", fg: "#78716c" });
  }
  if (row.isSupported) {
    badges.push({ label: "Supported", bg: "rgba(74,139,106,0.12)", fg: color.forest });
  }

  if (badges.length === 0) {
    return <span style={{ color: color.muted }}>—</span>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {badges.map((badge) => (
        <span
          key={badge.label}
          style={{ ...BADGE_BASE, background: badge.bg, color: badge.fg }}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

export function OrgEmployeesSection({ orgId }: { orgId: string }) {
  const apiBase = `/api/admin/orgs/${orgId}`;
  const { isAdmin } = useWorkspace();

  const [rows, setRows] = useState<UnifiedEmployeeRow[]>([]);
  const [stats, setStats] = useState({ total: 0, contributing: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [addingMember, setAddingMember] = useState(false);

  const [clientEmail, setClientEmail] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [assigningClient, setAssigningClient] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  const [drawerRow, setDrawerRow] = useState<UnifiedEmployeeRow | null>(null);
  const [removingMemberUserId, setRemovingMemberUserId] = useState<string | null>(null);
  const [removingClientUserId, setRemovingClientUserId] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [connectingMemberId, setConnectingMemberId] = useState<string | null>(null);
  const [disconnectingMemberId, setDisconnectingMemberId] = useState<string | null>(null);
  const [poolByMember, setPoolByMember] = useState<Record<string, boolean>>({});

  const canReview = true;
  const canImpersonate = isAdmin;
  const { startingUserId, viewAsAdmin, viewAsEmployee } = useEmployeeViewAs({
    reviewReturnPath: `/admin/orgs/${orgId}#employees`,
    reviewReturnLabel: "Back to organization",
    canReview,
    canImpersonate,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, clientsRes] = await Promise.all([
        fetch(`${apiBase}/network-sources`),
        fetch(`${apiBase}/clients`),
      ]);

      const membersData = (await membersRes.json()) as {
        members?: TeamMemberRow[];
        stats?: { total: number; contributing: number };
        error?: string;
      };
      const clientsData = (await clientsRes.json()) as {
        clients?: SupportedClientRow[];
        error?: string;
      };

      if (!membersRes.ok) throw new Error(membersData.error ?? "Could not load team employees.");
      if (!clientsRes.ok) throw new Error(clientsData.error ?? "Could not load supported employees.");

      setRows(mergeEmployees(membersData.members ?? [], clientsData.clients ?? []));
      setStats(membersData.stats ?? { total: 0, contributing: 0 });
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load employees."));
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const supportedCount = useMemo(() => rows.filter((row) => row.isSupported).length, [rows]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const email = memberEmail.trim();
    if (!email) return;

    setAddingMember(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: memberRole }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add team member.");
      setMemberEmail("");
      setMemberRole("MEMBER");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not add team member."));
    } finally {
      setAddingMember(false);
    }
  }

  async function assignClient(e: React.FormEvent) {
    e.preventDefault();
    const email = clientEmail.trim();
    if (!email) return;

    setAssigningClient(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, notes: clientNotes.trim() || undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not assign employee.");
      setClientEmail("");
      setClientNotes("");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not assign employee."));
    } finally {
      setAssigningClient(false);
    }
  }

  async function updateRole(userId: string, role: "ADMIN" | "MEMBER") {
    setUpdatingRoleUserId(userId);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not update role.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not update role."));
    } finally {
      setUpdatingRoleUserId(null);
    }
  }

  async function removeMember(userId: string) {
    setRemovingMemberUserId(userId);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove member.");
      if (drawerRow?.userId === userId) setDrawerRow(null);
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not remove member."));
    } finally {
      setRemovingMemberUserId(null);
    }
  }

  async function removeClient(userId: string) {
    setRemovingClientUserId(userId);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/clients`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: userId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove assignment.");
      if (drawerRow?.userId === userId) setDrawerRow(null);
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not remove assignment."));
    } finally {
      setRemovingClientUserId(null);
    }
  }

  async function connectMember(memberId: string, provider: "google" | "microsoft") {
    setConnectingMemberId(memberId);
    setError(null);
    try {
      const visibility = poolByMember[memberId] ? "POOLED" : "PRIVATE";
      const res = await fetch(`${apiBase}/members/${memberId}/network-source/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, visibility }),
      });
      const data = (await res.json()) as { authUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not start connect.");
      if (data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not start connect."));
    } finally {
      setConnectingMemberId(null);
    }
  }

  async function disconnectMember(memberId: string) {
    setDisconnectingMemberId(memberId);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/members/${memberId}/network-source/disconnect`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not disconnect.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not disconnect."));
    } finally {
      setDisconnectingMemberId(null);
    }
  }

  return (
    <>
      <ScoutBox padding={20} id="employees">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
          <ScoutLabel>Employees</ScoutLabel>
          <Link
            href={`/org/${orgId}/contacts`}
            style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, textDecoration: "underline" }}
          >
            Browse pooled contacts →
          </Link>
        </div>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 16px" }}>
          Everyone in this org — team members who contribute network, and supported employees for intro matching.
          {" "}
          <span style={{ fontFamily: fontMono, fontSize: T.caption }}>
            {rows.length} people · {stats.contributing} of {stats.total} sharing pooled network · {supportedCount} supported
          </span>
        </p>

        {error && (
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 12px" }}>{error}</p>
        )}

        {createNotice && (
          <div
            style={{
              background: "rgba(26,58,47,0.06)",
              border: "var(--scout-border)",
              padding: "12px 16px",
              marginBottom: 16,
              fontSize: T.bodySm,
              color: color.stone,
              lineHeight: 1.5,
            }}
          >
            {createNotice}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <form onSubmit={(e) => void addMember(e)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: 0, textTransform: "uppercase" }}>
              Add team member
            </p>
            <input
              style={inputStyle}
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="admin@company.com"
              required
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                style={{ ...inputStyle, width: "auto", minWidth: 110 }}
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as "ADMIN" | "MEMBER")}
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <ScoutPrimaryBtn type="submit" disabled={addingMember || !memberEmail.trim()}>
                {addingMember ? "Adding…" : "Add"}
              </ScoutPrimaryBtn>
            </div>
          </form>

          <form onSubmit={(e) => void assignClient(e)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: 0, textTransform: "uppercase" }}>
                Assign supported employee
              </p>
              <ScoutPrimaryBtn
                type="button"
                onClick={() => {
                  setShowCreate(true);
                  setCreateNotice(null);
                }}
                style={{ minHeight: 36, fontSize: T.caption }}
              >
                + Create
              </ScoutPrimaryBtn>
            </div>
            <input
              style={inputStyle}
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="employee@company.com"
              required
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Notes (optional)"
              />
              <ScoutPrimaryBtn type="submit" disabled={assigningClient || !clientEmail.trim()}>
                {assigningClient ? "Assigning…" : "Assign"}
              </ScoutPrimaryBtn>
            </div>
          </form>
        </div>

        {loading ? (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading employees…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
            No employees yet — add a team member or assign a supported employee.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: T.bodySm }}>
              <thead>
                <tr style={{ textAlign: "left", color: color.muted, fontFamily: fontMono, fontSize: T.caption, textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 8px" }}>Name</th>
                  <th style={{ padding: "10px 8px" }}>Type</th>
                  <th style={{ padding: "10px 8px" }}>Role</th>
                  <th style={{ padding: "10px 8px" }}>Inbox</th>
                  <th style={{ padding: "10px 8px" }}>Matches</th>
                  <th style={{ padding: "10px 8px" }}>View as</th>
                  <th style={{ padding: "10px 8px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = row.source?.status ?? "DISCONNECTED";
                  const statusStyle = STATUS_STYLE[status];
                  const visibility = row.source?.visibility ?? "PRIVATE";
                  const visibilityStyle = VISIBILITY_STYLE[visibility];
                  const isConnected = status === "ACTIVE";
                  const memberId = row.orgMemberId;
                  const busy =
                    connectingMemberId === memberId ||
                    disconnectingMemberId === memberId ||
                    removingMemberUserId === row.userId ||
                    removingClientUserId === row.userId ||
                    updatingRoleUserId === row.userId;

                  return (
                    <tr
                      key={row.userId}
                      style={{ borderTop: border.line, cursor: "pointer" }}
                      onClick={() => setDrawerRow(row)}
                    >
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ color: color.ink, fontWeight: 600 }}>{row.name ?? row.email}</div>
                        <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>{row.email}</div>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <RoleBadges row={row} />
                      </td>
                      <td style={{ padding: "12px 8px" }} onClick={(e) => e.stopPropagation()}>
                        {row.isTeamMember && row.orgRole ? (
                          <select
                            style={{ ...inputStyle, width: "auto", minWidth: 110, padding: "6px 8px" }}
                            value={row.orgRole}
                            disabled={busy}
                            onChange={(e) => void updateRole(row.userId, e.target.value as "ADMIN" | "MEMBER")}
                          >
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        ) : (
                          <span style={{ color: color.muted }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px" }} onClick={(e) => e.stopPropagation()}>
                        {row.isTeamMember && memberId ? (
                          <div>
                            <span
                              style={{
                                ...BADGE_BASE,
                                background: statusStyle.bg,
                                color: statusStyle.color,
                              }}
                            >
                              {statusStyle.label}
                            </span>
                            {row.source?.email && (
                              <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                                {row.source.email}
                              </div>
                            )}
                            {isConnected && (
                              <div style={{ marginTop: 6 }}>
                                <span
                                  style={{
                                    ...BADGE_BASE,
                                    background: visibilityStyle.bg,
                                    color: visibilityStyle.color,
                                  }}
                                >
                                  {visibilityStyle.label}
                                </span>
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={poolByMember[memberId] ?? visibility === "POOLED"}
                                  onChange={(e) =>
                                    setPoolByMember((prev) => ({ ...prev, [memberId]: e.target.checked }))
                                  }
                                />
                                <span style={{ fontSize: T.caption, color: color.muted }}>Pool</span>
                              </label>
                              <ScoutSecondaryBtn disabled={busy} onClick={() => void connectMember(memberId, "google")}>
                                {busy ? "…" : isConnected ? "Gmail" : "Connect Gmail"}
                              </ScoutSecondaryBtn>
                              <ScoutSecondaryBtn disabled={busy} onClick={() => void connectMember(memberId, "microsoft")}>
                                {busy ? "…" : isConnected ? "Outlook" : "Connect Outlook"}
                              </ScoutSecondaryBtn>
                              {isConnected && (
                                <ScoutSecondaryBtn disabled={busy} onClick={() => void disconnectMember(memberId)}>
                                  Disconnect
                                </ScoutSecondaryBtn>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: color.muted }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {row.isSupported ? (
                          <EmployeeIntroMatchPreviewStack
                            orgId={orgId}
                            clientUserId={row.userId}
                            apiBase={apiBase}
                            compact
                          />
                        ) : (
                          <span style={{ color: color.muted }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <EmployeeViewAsActions
                          userId={row.userId}
                          startingUserId={startingUserId}
                          canReview={canReview}
                          canImpersonate={canImpersonate}
                          onViewAsAdmin={viewAsAdmin}
                          onViewAsEmployee={viewAsEmployee}
                          compact
                        />
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                          {row.isTeamMember && (
                            <ScoutSecondaryBtn disabled={busy} onClick={() => void removeMember(row.userId)}>
                              {removingMemberUserId === row.userId ? "…" : "Remove from team"}
                            </ScoutSecondaryBtn>
                          )}
                          {row.isSupported && (
                            <ScoutSecondaryBtn disabled={busy} onClick={() => void removeClient(row.userId)}>
                              {removingClientUserId === row.userId ? "…" : "Remove assignment"}
                            </ScoutSecondaryBtn>
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

        <OrgIntroMatchPriorityPanel orgId={orgId} apiBase={apiBase} />

        {showCreate && (
          <CreateClientModal
            apiUrl={`${apiBase}/clients/provision`}
            title="Create employee for org"
            description="Creates a new employee account and assigns them to this organization. Resume, LinkedIn, and sign-in invite are optional."
            onClose={() => setShowCreate(false)}
            onCreated={(data) => {
              const assignment = data.assignment as SupportedClientRow | undefined;
              const warnings = Array.isArray(data.warnings) ? (data.warnings as string[]) : [];
              void load();
              setCreateNotice(
                warnings.length > 0
                  ? warnings.join(" ")
                  : assignment
                    ? "Employee created and assigned to this org."
                    : "Employee created.",
              );
            }}
          />
        )}
      </ScoutBox>

      {drawerRow && (
        <EmployeeIntroDrawer
          orgId={orgId}
          person={{
            userId: drawerRow.userId,
            email: drawerRow.email,
            name: drawerRow.name,
          }}
          client={toDrawerClient(drawerRow)}
          teamMember={toDrawerTeamMember(drawerRow)}
          apiBase={apiBase}
          onClose={() => setDrawerRow(null)}
          canReview={canReview}
          canImpersonate={canImpersonate}
          startingUserId={startingUserId}
          onViewAsAdmin={viewAsAdmin}
          onViewAsEmployee={viewAsEmployee}
        />
      )}
    </>
  );
}

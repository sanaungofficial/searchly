"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrgMemberRow = {
  id: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
  user: { id: string; email: string; name: string | null };
  invitedBy: { id: string; email: string; name: string | null } | null;
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

const ROLE_STYLE: Record<OrgMemberRow["role"], { bg: string; color: string }> = {
  ADMIN: { bg: "rgba(26,58,47,0.1)", color: color.forest },
  MEMBER: { bg: "rgba(160,152,144,0.12)", color: "#78716c" },
};

export function AdminOrgDetailPanel({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [members, setMembers] = useState<OrgMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<OrgMemberRow["role"]>("MEMBER");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}`);
      const data = (await res.json()) as {
        org?: OrgDetail;
        members?: OrgMemberRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load organization.");
      setOrg(data.org ?? null);
      setMembers(data.members ?? []);
      if (data.org) {
        setName(data.org.name);
        setSlug(data.org.slug);
        setWebsite(data.org.website ?? "");
        setLogoUrl(data.org.logoUrl ?? "");
      }
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load organization."));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          website: website.trim() || null,
          logoUrl: logoUrl.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save organization.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not save organization."));
    } finally {
      setSaving(false);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const email = memberEmail.trim();
    if (!email) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: memberRole }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add member.");
      setMemberEmail("");
      setMemberRole("MEMBER");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not add member."));
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(userId: string) {
    setRemovingUserId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove member.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not remove member."));
    } finally {
      setRemovingUserId(null);
    }
  }

  async function deleteOrg() {
    if (!org) return;
    if (!window.confirm(`Delete "${org.name}" and all memberships? This cannot be undone.`)) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not delete organization.");
      router.push("/admin/orgs");
      router.refresh();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not delete organization."));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>Loading organization…</p>;
  }

  if (!org) {
    return (
      <ScoutBox padding={20}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Organization not found.</p>
        <Link href="/admin/orgs" style={{ color: color.forest, textDecoration: "underline", fontSize: T.bodySm }}>
          Back to organizations
        </Link>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <Link href="/admin/orgs" style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "none" }}>
          ← Organizations
        </Link>
        <h1 style={{ ...displayTitleStyle(32), margin: "12px 0 8px" }}>{org.name}</h1>
        <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: 0 }}>{org.slug}</p>
      </div>

      {error && <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: 0 }}>{error}</p>}

      <ScoutBox padding={20}>
        <ScoutLabel>Org settings</ScoutLabel>
        <form onSubmit={(e) => void saveOrg(e)} style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Name</span>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Slug</span>
              <input style={inputStyle} value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Website</span>
              <input style={inputStyle} value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Logo URL</span>
              <input style={inputStyle} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ScoutPrimaryBtn type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </ScoutPrimaryBtn>
            <ScoutSecondaryBtn type="button" onClick={() => void deleteOrg()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete org"}
            </ScoutSecondaryBtn>
          </div>
        </form>
      </ScoutBox>

      <ScoutBox padding={20}>
        <ScoutLabel>Members</ScoutLabel>
        <form
          onSubmit={(e) => void addMember(e)}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 1fr) 160px auto",
            gap: 12,
            marginTop: 12,
            marginBottom: 20,
            alignItems: "end",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Kimchi user email</span>
            <input
              style={inputStyle}
              type="email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="admin@company.com"
              required
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Role</span>
            <select
              style={inputStyle}
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as OrgMemberRow["role"])}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <ScoutPrimaryBtn type="submit" disabled={adding || !memberEmail.trim()}>
            {adding ? "Adding…" : "Add member"}
          </ScoutPrimaryBtn>
        </form>

        {members.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
            No members yet — add a Kimchi user by email.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: T.bodySm }}>
              <thead>
                <tr style={{ textAlign: "left", color: color.muted, fontFamily: fontMono, fontSize: T.caption, textTransform: "uppercase" }}>
                  <th style={{ padding: "10px 8px" }}>User</th>
                  <th style={{ padding: "10px 8px" }}>Role</th>
                  <th style={{ padding: "10px 8px" }}>Joined</th>
                  <th style={{ padding: "10px 8px" }}>Invited by</th>
                  <th style={{ padding: "10px 8px" }} />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const roleStyle = ROLE_STYLE[member.role];
                  return (
                    <tr key={member.id} style={{ borderTop: "var(--scout-border)" }}>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ color: color.ink, fontWeight: 600 }}>{member.user.name ?? member.user.email}</div>
                        <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>{member.user.email}</div>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        <span
                          style={{
                            fontFamily: fontMono,
                            fontSize: T.caption,
                            padding: "2px 7px",
                            borderRadius: "var(--scout-radius)",
                            background: roleStyle.bg,
                            color: roleStyle.color,
                          }}
                        >
                          {member.role.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 8px", color: color.muted }}>
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 8px", color: color.muted }}>
                        {member.invitedBy?.email ?? "—"}
                      </td>
                      <td style={{ padding: "12px 8px", textAlign: "right" }}>
                        <ScoutSecondaryBtn
                          onClick={() => void removeMember(member.user.id)}
                          disabled={removingUserId === member.user.id}
                        >
                          {removingUserId === member.user.id ? "Removing…" : "Remove"}
                        </ScoutSecondaryBtn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ScoutBox>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { OrgEmployeesSection } from "@/components/admin/org-employees-section";
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

export function AdminOrgDetailPanel({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orgs/${orgId}`);
      const data = (await res.json()) as {
        org?: OrgDetail;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load organization.");
      setOrg(data.org ?? null);
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

      <OrgEmployeesSection orgId={orgId} />
    </div>
  );
}

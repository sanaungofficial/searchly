"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CompanySuggestAutocompleteInput } from "@/components/company-suggest-autocomplete-input";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { CompanyLogo } from "@/components/scout/company-logo";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import type { CompanySuggestItem } from "@/lib/company-intel";
import { color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  logoUrl: string | null;
  memberCount?: number;
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

export function AdminOrgsPanel() {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<CompanySuggestItem | null>(null);

  function resetCreateForm() {
    setName("");
    setSlug("");
    setWebsite("");
    setLogoUrl("");
    setSelectedCompany(null);
  }

  function applyCompanySuggestion(item: CompanySuggestItem) {
    setSelectedCompany(item);
    setName(item.name);
    setSlug(item.catalogSlug);
    setWebsite(item.website ?? "");
    setLogoUrl(item.logoUrl ?? "");
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orgs");
      const data = (await res.json()) as { orgs?: OrgRow[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load organizations.");
      setOrgs(data.orgs ?? []);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load organizations."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: slug.trim() || undefined,
          website: website.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
        }),
      });
      const data = (await res.json()) as OrgRow & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not create organization.");

      resetCreateForm();
      setShowForm(false);
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not create organization."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <ScoutBox padding={20}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <ScoutLabel>Enterprise organizations</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 0", lineHeight: 1.55, maxWidth: 640 }}>
            Platform-managed orgs for company admin portals. Membership uses OrgMemberRole on normal Kimchi user accounts.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ScoutSecondaryBtn onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New org"}
          </ScoutSecondaryBtn>
          <ScoutSecondaryBtn onClick={() => void load()} disabled={loading}>
            Refresh
          </ScoutSecondaryBtn>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => void createOrg(e)}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 20,
            padding: 16,
            background: surface.inset,
            borderRadius: "var(--scout-radius)",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
            <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
              Organization name
            </span>
            <CompanySuggestAutocompleteInput
              value={name}
              onChange={setName}
              onSelect={(item) => {
                if (item) applyCompanySuggestion(item);
                else setSelectedCompany(null);
              }}
              placeholder="Search Hirebase — e.g. Stripe, Comcast, Oracle"
              inputStyle={inputStyle}
              required
            />
            {selectedCompany && (
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "4px 0 0" }}>
                Prefilled from {selectedCompany.source === "hirebase" ? "Hirebase" : selectedCompany.source}.
                Edit fields below before creating if needed.
              </p>
            )}
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Slug (optional)</span>
            <input style={inputStyle} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-corp" />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Website (optional)</span>
            <input style={inputStyle} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" />
          </label>
          {(logoUrl.trim() || selectedCompany) && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Logo preview</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
                <CompanyLogo
                  name={name || "Organization"}
                  website={website}
                  logoUrl={logoUrl}
                  size={36}
                  borderRadius={0}
                />
                <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, wordBreak: "break-all" }}>
                  {logoUrl.trim() || "No logo URL"}
                </span>
              </div>
            </label>
          )}
          <div style={{ display: "flex", alignItems: "end" }}>
            <ScoutPrimaryBtn type="submit" disabled={creating || !name.trim()}>
              {creating ? "Creating…" : "Create org"}
            </ScoutPrimaryBtn>
          </div>
        </form>
      )}

      {error && <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading organizations…</p>
      ) : orgs.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          No organizations yet — create one to assign company admins and members.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: T.bodySm }}>
            <thead>
              <tr style={{ textAlign: "left", color: color.muted, fontFamily: fontMono, fontSize: T.caption, textTransform: "uppercase" }}>
                <th style={{ padding: "10px 8px" }}>Organization</th>
                <th style={{ padding: "10px 8px" }}>Slug</th>
                <th style={{ padding: "10px 8px" }}>Members</th>
                <th style={{ padding: "10px 8px" }}>Created</th>
                <th style={{ padding: "10px 8px" }} />
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.id} style={{ borderTop: "var(--scout-border)" }}>
                  <td style={{ padding: "12px 8px", color: color.ink, fontWeight: 600 }}>{org.name}</td>
                  <td style={{ padding: "12px 8px", fontFamily: fontMono, color: color.muted }}>{org.slug}</td>
                  <td style={{ padding: "12px 8px", color: color.muted }}>{org.memberCount ?? 0}</td>
                  <td style={{ padding: "12px 8px", color: color.muted }}>
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "right" }}>
                    <Link href={`/admin/orgs/${org.id}`} style={{ color: color.forest, textDecoration: "underline" }}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ScoutBox>
  );
}

export function AdminOrgsPageHeader() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block" }} />
        <ScoutLabel>Enterprise</ScoutLabel>
      </div>
      <h1 style={{ ...displayTitleStyle(32), margin: "0 0 8px" }}>Organizations</h1>
      <p style={{ fontSize: T.bodySm, color: color.muted, margin: 0 }}>
        Create orgs and assign company admins (OrgMemberRole.ADMIN) on existing Kimchi user accounts.
      </p>
    </div>
  );
}

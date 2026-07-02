"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox, ScoutLabel, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

type KnownByRow = {
  networkSourceId: string;
  lastSeenAt: string | null;
  member: { id: string; email: string; name: string | null };
};

type OrgContactRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  title: string | null;
  lastActivityAt: string | null;
  knownBy: KnownByRow[];
};

type ContactsResponse = {
  contacts?: OrgContactRow[];
  total?: number;
  error?: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "var(--scout-border)",
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: T.bodySm,
  boxSizing: "border-box",
  background: "var(--scout-card, #fff)",
  color: color.ink,
};

function formatKnownBy(members: KnownByRow[]): string {
  const names = members
    .map((row) => row.member.name ?? row.member.email.split("@")[0])
    .filter(Boolean);
  if (names.length === 0) return "—";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function OrgPooledContactsSection({ orgId }: { orgId: string }) {
  const [contacts, setContacts] = useState<OrgContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCompany, setAppliedCompany] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
      if (appliedCompany.trim()) params.set("company", appliedCompany.trim());

      const res = await fetch(`/api/admin/orgs/${orgId}/contacts?${params.toString()}`);
      const data = (await res.json()) as ContactsResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not load contacts.");
      setContacts(data.contacts ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load contacts."));
    } finally {
      setLoading(false);
    }
  }, [orgId, appliedSearch, appliedCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setAppliedSearch(search);
    setAppliedCompany(company);
  }

  return (
    <ScoutBox padding={20}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <ScoutLabel>Pooled network contacts</ScoutLabel>
        <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
          {total} contact{total === 1 ? "" : "s"} from pooled sources
        </span>
      </div>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 16px" }}>
        Metadata-only relationship graph — email subjects and meeting titles, no message bodies.
      </p>

      <form
        onSubmit={applyFilters}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 1fr) auto",
          gap: 12,
          marginBottom: 16,
          alignItems: "end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Search</span>
          <input
            style={inputStyle}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, title…"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Company</span>
          <input
            style={inputStyle}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Acme"
          />
        </label>
        <ScoutSecondaryBtn type="submit" disabled={loading}>
          {loading ? "Loading…" : "Filter"}
        </ScoutSecondaryBtn>
      </form>

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "0 0 12px" }}>{error}</p>
      )}

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading contacts…</p>
      ) : contacts.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          No pooled contacts yet — connect member inboxes with pooled visibility to backfill the org graph.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: T.bodySm }}>
            <thead>
              <tr style={{ textAlign: "left", color: color.muted, fontFamily: fontMono, fontSize: T.caption, textTransform: "uppercase" }}>
                <th style={{ padding: "10px 8px" }}>Name</th>
                <th style={{ padding: "10px 8px" }}>Email</th>
                <th style={{ padding: "10px 8px" }}>Company</th>
                <th style={{ padding: "10px 8px" }}>Title</th>
                <th style={{ padding: "10px 8px" }}>Known by</th>
                <th style={{ padding: "10px 8px" }}>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} style={{ borderTop: "var(--scout-border)" }}>
                  <td style={{ padding: "12px 8px", color: color.ink, fontWeight: 600 }}>
                    {contact.name ?? "—"}
                  </td>
                  <td style={{ padding: "12px 8px", fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>
                    {contact.email}
                  </td>
                  <td style={{ padding: "12px 8px" }}>{contact.company ?? "—"}</td>
                  <td style={{ padding: "12px 8px", color: color.muted }}>{contact.title ?? "—"}</td>
                  <td style={{ padding: "12px 8px" }}>{formatKnownBy(contact.knownBy)}</td>
                  <td style={{ padding: "12px 8px", color: color.muted }}>
                    {contact.lastActivityAt
                      ? new Date(contact.lastActivityAt).toLocaleDateString()
                      : "—"}
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

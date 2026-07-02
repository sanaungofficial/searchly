"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutPrimaryBtn, ScoutSecondaryBtn, ScoutLabel } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type TargetCompany = { id: string; name: string; website: string | null };

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

export function OrgEmployeeTargetEmployersSection({
  orgId,
  userId,
  readOnly = false,
  onChange,
}: {
  orgId: string;
  userId: string;
  readOnly?: boolean;
  onChange?: (count: number) => void;
}) {
  const [companies, setCompanies] = useState<TargetCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");

  const apiBase = `/api/org/${orgId}/employees/${userId}/target-companies`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase);
      const data = (await res.json()) as { companies?: TargetCompany[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load target employers.");
      const list = data.companies ?? [];
      setCompanies(list);
      onChange?.(list.length);
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not load target employers."));
    } finally {
      setLoading(false);
    }
  }, [apiBase, onChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCompany(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || readOnly) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, website: website.trim() || undefined }),
      });
      const data = (await res.json()) as { company?: TargetCompany; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add target employer.");
      setName("");
      setWebsite("");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not add target employer."));
    } finally {
      setAdding(false);
    }
  }

  async function removeCompany(companyId: string) {
    if (readOnly) return;
    setRemovingId(companyId);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove target employer.");
      await load();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Could not remove target employer."));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <ScoutLabel>Target employers</ScoutLabel>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
        Companies this employee is targeting — used to find warm intro paths through your pooled network.
      </p>

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "8px 0 0" }}>{error}</p>
      )}

      {!readOnly && (
        <form
          onSubmit={(e) => void addCompany(e)}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 1fr) minmax(160px, 1fr) auto",
            gap: 12,
            marginTop: 16,
            alignItems: "end",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Company name</span>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              required
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>Website (optional)</span>
            <input
              style={inputStyle}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="acme.com"
            />
          </label>
          <ScoutPrimaryBtn type="submit" disabled={adding || !name.trim()}>
            {adding ? "Adding…" : "Add"}
          </ScoutPrimaryBtn>
        </form>
      )}

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "12px 0 0" }}>
          Loading target employers…
        </p>
      ) : companies.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "12px 0 0" }}>
          {readOnly
            ? "No target employers set yet."
            : "No target employers yet — add companies to enable intro match search."}
        </p>
      ) : (
        <ul
          style={{
            margin: "12px 0 0",
            padding: 0,
            listStyle: "none",
            fontFamily: fontSans,
            fontSize: T.bodySm,
            color: color.stone,
          }}
        >
          {companies.map((c) => (
            <li
              key={c.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderTop: border.line,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: color.ink }}>{c.name}</div>
                {c.website && (
                  <div style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted }}>{c.website}</div>
                )}
              </div>
              {!readOnly && (
                <ScoutSecondaryBtn
                  onClick={() => void removeCompany(c.id)}
                  disabled={removingId === c.id}
                >
                  {removingId === c.id ? "Removing…" : "Remove"}
                </ScoutSecondaryBtn>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

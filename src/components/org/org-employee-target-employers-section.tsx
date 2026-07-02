"use client";

import { useCallback, useEffect, useState } from "react";
import { CompanySuggestAutocompleteInput } from "@/components/company-suggest-autocomplete-input";
import { CompanyLogo } from "@/components/scout/company-logo";
import { ScoutLabel } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import type { CompanySuggestItem } from "@/lib/company-intel";
import { getCatalogCompany, normalizeCompanySlug } from "@/lib/company-catalog";
import { color, fontSans, type as T } from "@/lib/typography";

type TargetCompany = {
  id: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  companyIntel: { slug: string; website: string | null; careersUrl: string | null } | null;
};

const TAG_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 8px 4px 6px",
  borderRadius: "var(--scout-radius)",
  border: "1px solid rgba(74,139,106,0.35)",
  background: "rgba(74,139,106,0.12)",
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 600,
  color: color.ink,
  maxWidth: "100%",
  lineHeight: 1.2,
};

function suggestWebsite(item: CompanySuggestItem): string | null {
  if (item.website?.trim()) return item.website.trim();
  if (item.careersUrl?.trim()) {
    try {
      return new URL(
        item.careersUrl.startsWith("http") ? item.careersUrl : `https://${item.careersUrl}`,
      ).hostname.replace(/^www\./, "");
    } catch {
      return item.careersUrl.trim();
    }
  }
  return null;
}

function targetCompanyLogoProps(company: TargetCompany) {
  const catalog = getCatalogCompany(
    company.companyIntel?.slug ?? normalizeCompanySlug(company.name),
  );
  return {
    name: company.name,
    website: company.website ?? company.companyIntel?.website ?? catalog?.website ?? null,
    careersUrl: company.careersUrl ?? company.companyIntel?.careersUrl ?? catalog?.careersUrl ?? null,
  };
}

export function OrgEmployeeTargetEmployersSection({
  orgId,
  userId,
  readOnly = false,
  showHeader = true,
  onChange,
}: {
  orgId: string;
  userId: string;
  readOnly?: boolean;
  showHeader?: boolean;
  onChange?: (count: number) => void;
}) {
  const [companies, setCompanies] = useState<TargetCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const apiBase = `/api/org/${orgId}/employees/${userId}/target-companies`;
  const existingNames = new Set(companies.map((c) => c.name.trim().toLowerCase()));

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

  async function addFromSuggestion(item: CompanySuggestItem | null) {
    if (readOnly || adding) return;
    const trimmed = (item?.name ?? query).trim();
    if (!trimmed || existingNames.has(trimmed.toLowerCase())) return;

    setAdding(true);
    setError(null);
    try {
      const website = item ? suggestWebsite(item) : null;
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, website: website ?? undefined }),
      });
      const data = (await res.json()) as { company?: TargetCompany; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add target employer.");
      setQuery("");
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
      {showHeader && (
        <>
          <ScoutLabel>Target employers</ScoutLabel>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
            Companies this employee is targeting — used to find warm intro paths through your pooled network.
          </p>
        </>
      )}

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: "#C4574A", margin: "8px 0 0" }}>{error}</p>
      )}

      {!readOnly && (
        <div style={{ marginTop: showHeader ? 12 : 0 }}>
          <CompanySuggestAutocompleteInput
            value={query}
            onChange={setQuery}
            onSelect={(item) => {
              if (item) void addFromSuggestion(item);
            }}
            onCreateAsNew={() => void addFromSuggestion(null)}
            placeholder="Search companies (e.g. Stripe)…"
            disabled={adding}
            showCreateAsNew
          />
        </div>
      )}

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "12px 0 0" }}>
          Loading target employers…
        </p>
      ) : companies.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "12px 0 0" }}>
          {readOnly ? "No target employers set yet." : "No target employers yet — search to add companies."}
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
            maxHeight: 160,
            overflowY: "auto",
          }}
        >
          {companies.map((c) => {
            const logoProps = targetCompanyLogoProps(c);
            return (
              <span key={c.id} style={TAG_STYLE} title={logoProps.website ?? c.name}>
                <CompanyLogo {...logoProps} size={18} borderRadius={4} />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 140,
                  }}
                >
                  {c.name}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Remove ${c.name}`}
                    disabled={removingId === c.id}
                    onClick={() => void removeCompany(c.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 16,
                      height: 16,
                      padding: 0,
                      border: "none",
                      borderRadius: "var(--scout-radius)",
                      background: "rgba(17,17,17,0.08)",
                      color: color.muted,
                      cursor: removingId === c.id ? "default" : "pointer",
                      flexShrink: 0,
                      fontSize: 13,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}

      {adding && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0" }}>
          Adding…
        </p>
      )}
    </div>
  );
}

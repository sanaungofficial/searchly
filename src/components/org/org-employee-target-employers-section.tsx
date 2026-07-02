"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScoutLabel } from "@/components/scout/scout-box";
import { formatApiErrorMessage } from "@/lib/api-error-message";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type TargetCompany = { id: string; name: string; website: string | null };

type CompanySuggestItem = {
  id: string | null;
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  logoUrl: string | null;
  type: string | null;
  source: "catalog" | "intel" | "hirebase";
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

const TAG_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 8px 5px 10px",
  borderRadius: "var(--scout-radius)",
  border: "1px solid rgba(74,139,106,0.35)",
  background: "rgba(74,139,106,0.12)",
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 600,
  color: color.ink,
  maxWidth: "100%",
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

function TargetEmployerAutocomplete({
  disabled,
  existingNames,
  onSelect,
}: {
  disabled: boolean;
  existingNames: Set<string>;
  onSelect: (item: CompanySuggestItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CompanySuggestItem[]>([]);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/suggest?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as CompanySuggestItem[];
          setSuggestions(data.filter((item) => !existingNames.has(item.name.trim().toLowerCase())));
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, open, existingNames]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(item: CompanySuggestItem) {
    onSelect(item);
    setQuery("");
    setOpen(false);
    setSuggestions([]);
  }

  function submitFreeText() {
    const trimmed = query.trim();
    if (!trimmed || existingNames.has(trimmed.toLowerCase())) return;
    choose({
      id: null,
      catalogSlug: trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: trimmed,
      website: null,
      careersUrl: null,
      logoUrl: null,
      type: null,
      source: "catalog",
    });
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", marginTop: 12 }}>
      <input
        style={inputStyle}
        value={query}
        placeholder="Search companies (Hirebase)…"
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (suggestions[0]) choose(suggestions[0]);
            else submitFreeText();
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && query.trim().length >= 2 && (
        <ul
          style={{
            position: "absolute",
            zIndex: 40,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            margin: 0,
            padding: 6,
            listStyle: "none",
            background: surface.card,
            border: border.line,
            borderRadius: "var(--scout-radius)",
            boxShadow: "0 8px 24px rgba(26,58,47,0.12)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {searching && (
            <li style={{ padding: "8px 10px", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
              Searching…
            </li>
          )}
          {!searching && suggestions.length === 0 && (
            <li style={{ padding: "8px 10px", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
              No matches — press Enter to add &quot;{query.trim()}&quot;
            </li>
          )}
          {suggestions.map((item) => {
            const website = suggestWebsite(item);
            return (
              <li key={`${item.catalogSlug}-${item.id ?? item.source}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(item);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: "var(--scout-radius)",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    color: color.ink,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  {(website || item.source === "hirebase") && (
                    <span style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, marginTop: 2 }}>
                      {website ?? "Hirebase"}
                      {item.source === "hirebase" && website ? " · Hirebase" : item.source === "hirebase" ? "" : ""}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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

  async function addFromSuggestion(item: CompanySuggestItem) {
    if (readOnly || adding) return;
    const trimmed = item.name.trim();
    if (!trimmed || existingNames.has(trimmed.toLowerCase())) return;

    setAdding(true);
    setError(null);
    try {
      const website = suggestWebsite(item);
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, website: website ?? undefined }),
      });
      const data = (await res.json()) as { company?: TargetCompany; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not add target employer.");
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

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "12px 0 0" }}>
          Loading target employers…
        </p>
      ) : companies.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "12px 0 0" }}>
          {readOnly
            ? "No target employers set yet."
            : "No target employers yet — search above to add companies."}
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 12,
          }}
        >
          {companies.map((c) => (
            <span key={c.id} style={TAG_STYLE} title={c.website ?? c.name}>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 160,
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
                    width: 18,
                    height: 18,
                    padding: 0,
                    border: "none",
                    borderRadius: "var(--scout-radius)",
                    background: "rgba(17,17,17,0.08)",
                    color: color.muted,
                    cursor: removingId === c.id ? "default" : "pointer",
                    flexShrink: 0,
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!readOnly && (
        <TargetEmployerAutocomplete
          disabled={adding}
          existingNames={existingNames}
          onSelect={(item) => void addFromSuggestion(item)}
        />
      )}
      {adding && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "6px 0 0" }}>
          Adding…
        </p>
      )}
    </div>
  );
}

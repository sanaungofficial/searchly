"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContactListFilter } from "@/lib/inbox-crm/list-contacts";
import { buildSenderAvatarUrls } from "@/lib/email-sender-display";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";
import { ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { InboxContactStatusBadge } from "./inbox-contact-status-badge";
import { InboxLeadsFilterDrawer } from "./inbox-leads-filter-drawer";
import { SenderAvatar } from "./sender-avatar";
import {
  DEFAULT_VISIBLE_COLUMNS,
  LEAD_COLUMNS,
  LEAD_SORT_OPTIONS,
  formatLeadDate,
  readStoredLeadColumns,
  sourceLabel,
  storeLeadColumns,
  type LeadColumnId,
  type LeadSortField,
} from "./inbox-leads-columns";

type ContactRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  title: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  contacted: boolean | null;
  source: string;
  status: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  savedToNylas: boolean;
  activityCount: number;
  lastActivity: { subject: string | null; occurredAt: string | null } | null;
  linkedJobs: { id: string; company: string; role: string; stage: string }[];
};

type ContactSuggestion = {
  contactId: string;
  email: string;
  name: string | null;
  company: string | null;
  reason: string;
  score: number;
  lastActivityAt: string | null;
};

type Props = {
  scopePath: (path: string) => string;
  onSelectContact: (contactId: string) => void;
  mailConnected?: boolean;
  onComposeTo?: (email: string) => void;
};

const PAGE_SIZE = 25;
const line = "var(--scout-border)";

export function InboxLeadsPanel({ scopePath, onSelectContact, mailConnected = true, onComposeTo }: Props) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<LeadSortField>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<ContactListFilter[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<LeadColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<ContactSuggestion[] | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleColumns(readStoredLeadColumns());
  }, []);

  const columnDefs = useMemo(
    () => LEAD_COLUMNS.filter((c) => visibleColumns.includes(c.id)),
    [visibleColumns],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      params.set("sort", sort);
      params.set("sortDir", sortDir);
      if (search.trim()) params.set("q", search.trim());
      if (filters.length) params.set("filters", JSON.stringify(filters));
      const res = await fetch(scopePath(`/api/user/inbox/contacts?${params.toString()}`));
      if (!res.ok) {
        setContacts([]);
        setTotal(0);
        return;
      }
      const data = await res.json();
      setContacts(data.contacts ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [scopePath, page, sort, sortDir, search, filters]);

  useEffect(() => {
    const t = setTimeout(() => {
      load().catch(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    setPage(1);
  }, [search, filters, sort, sortDir]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (columnsOpen && columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
      if (sortOpen && sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [columnsOpen, sortOpen]);

  function toggleColumn(id: LeadColumnId) {
    setVisibleColumns((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      if (next.length === 0) return prev;
      storeLeadColumns(next);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.id)));
  }

  async function suggestFromInbox() {
    if (!mailConnected) {
      setSuggestError("Connect your inbox first to suggest contacts from recent mail.");
      return;
    }
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await fetch(scopePath("/api/user/inbox/contacts/suggest-from-inbox"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 15 }),
      });
      const data = (await res.json()) as { suggestions?: ContactSuggestion[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not suggest contacts.");
      setSuggestions(data.suggestions ?? []);
      if ((data.suggestions ?? []).length === 0) {
        setSuggestError("No new suggestions — try syncing mail from the Inbox tab first.");
      }
    } catch (e) {
      setSuggestions(null);
      setSuggestError(e instanceof Error ? e.message : "Could not suggest contacts.");
    } finally {
      setSuggesting(false);
    }
  }

  function renderCell(col: LeadColumnId, row: ContactRow) {
    switch (col) {
      case "name": {
        const avatar = buildSenderAvatarUrls(row.name ?? row.email, row.email);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <SenderAvatar
              primary={avatar.primary}
              fallback={avatar.fallback}
              initials={avatar.initials}
              displayName={avatar.displayName}
              size={28}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectContact(row.id);
              }}
              style={{
                border: "none",
                background: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: fontSans,
                fontSize: T.body,
                fontWeight: 600,
                color: "#2563EB",
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.name ?? row.email}
            </button>
          </div>
        );
      }
      case "email":
        return (
          <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink }}>{row.email}</span>
        );
      case "phone":
        return row.phone ? (
          <a
            href={`tel:${row.phone.replace(/\s/g, "")}`}
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#2563EB" }}
          >
            {row.phone}
          </a>
        ) : (
          <CellText value={null} />
        );
      case "company":
        return <CellText value={row.company} />;
      case "title":
        return <CellText value={row.title} />;
      case "status":
        return <InboxContactStatusBadge status={row.status} size="lg" />;
      case "linkedJobs":
        return (
          <CellText
            value={
              row.linkedJobs.length
                ? row.linkedJobs.map((j) => `${j.role} @ ${j.company}`).join(", ")
                : null
            }
          />
        );
      case "lastActivity":
        return (
          <CellText
            value={
              row.lastActivity?.occurredAt
                ? formatLeadDate(row.lastActivity.occurredAt)
                : row.lastActivityAt
                  ? formatLeadDate(row.lastActivityAt)
                  : null
            }
          />
        );
      case "source":
        return <CellText value={sourceLabel(row.source)} />;
      case "contacted":
        return <CellText value={row.contacted == null ? null : row.contacted ? "Yes" : "No"} />;
      case "linkedinUrl":
        return row.linkedinUrl ? (
          <a
            href={row.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: fontSans, fontSize: 12, color: "#2563EB" }}
          >
            Profile
          </a>
        ) : (
          <CellText value={null} />
        );
      case "notes":
        return <CellText value={row.notes} truncate />;
      case "createdAt":
        return <CellText value={formatLeadDate(row.createdAt)} />;
      case "updatedAt":
        return <CellText value={formatLeadDate(row.updatedAt)} />;
      default:
        return null;
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: surface.card }}>
      {(suggestions !== null || suggestError) && (
        <div
          style={{
            padding: "12px 16px",
            borderBottom: line,
            background: suggestions?.length ? "rgba(74,139,106,0.08)" : "rgba(196,87,74,0.06)",
          }}
        >
          {suggestions && suggestions.length > 0 ? (
            <>
              <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                {suggestions.length} contact{suggestions.length === 1 ? "" : "s"} suggested from your inbox
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                {suggestions.slice(0, 5).map((s) => (
                  <li key={s.contactId} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <button
                      type="button"
                      onClick={() => onSelectContact(s.contactId)}
                      style={{
                        border: "none",
                        background: "none",
                        padding: 0,
                        cursor: "pointer",
                        fontFamily: fontSans,
                        fontSize: T.bodySm,
                        color: color.forest,
                        textDecoration: "underline",
                        textAlign: "left",
                      }}
                    >
                      {s.name ?? s.email}
                    </button>
                    <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>{s.reason}</span>
                  </li>
                ))}
              </ul>
              {suggestions.length > 5 && (
                <p style={{ margin: "8px 0 0", fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                  +{suggestions.length - 5} more — search or scroll the table below.
                </p>
              )}
            </>
          ) : suggestError ? (
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A" }}>{suggestError}</p>
          ) : null}
          <div style={{ marginTop: 10 }}>
            <ScoutSecondaryBtn onClick={() => { setSuggestions(null); setSuggestError(null); }}>
              Dismiss
            </ScoutSecondaryBtn>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: line,
          background: "#FAFAFA",
        }}
      >
        <input
          type="search"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 180,
            maxWidth: 360,
            padding: "8px 12px",
            border: line,
            borderRadius: 8,
            fontFamily: fontSans,
            fontSize: T.bodySm,
            background: "#fff",
          }}
        />
        <button type="button" onClick={() => setFilterOpen(true)} style={toolbarBtn(filters.length > 0)}>
          + Add filter{filters.length > 0 ? ` (${filters.length})` : ""}
        </button>
        <ScoutPrimaryBtn
          onClick={() => void suggestFromInbox()}
          disabled={suggesting}
          style={{ padding: "8px 14px", minHeight: 36, fontSize: T.bodySm }}
        >
          {suggesting ? "Scanning inbox…" : "Suggest from inbox"}
        </ScoutPrimaryBtn>
        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, whiteSpace: "nowrap" }}>
          {total.toLocaleString()} contact{total === 1 ? "" : "s"}
        </span>
        <div ref={sortRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => setSortOpen((v) => !v)} style={toolbarBtn(false)}>
            ↕ Sort
          </button>
          {sortOpen && (
            <div style={popoverStyle}>
              {LEAD_SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (sort === opt.id) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                    else {
                      setSort(opt.id);
                      setSortDir("desc");
                    }
                    setSortOpen(false);
                  }}
                  style={menuItem(sort === opt.id)}
                >
                  {opt.label}
                  {sort === opt.id ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={columnsRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => setColumnsOpen((v) => !v)} style={toolbarBtn(false)}>
            ⊞ Columns
          </button>
          {columnsOpen && (
            <div style={{ ...popoverStyle, width: 280, maxHeight: 360, overflowY: "auto" }}>
              <p style={{ margin: "0 0 8px", padding: "0 4px", fontFamily: fontSans, fontSize: 11, fontWeight: 700, color: color.muted }}>
                CONTACTS
              </p>
              {LEAD_COLUMNS.map((col) => (
                <label
                  key={col.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 4px",
                    cursor: "pointer",
                    fontFamily: fontSans,
                    fontSize: 13,
                    color: color.ink,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.id)}
                    onChange={() => toggleColumn(col.id)}
                  />
                  {col.label}
                </label>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, paddingTop: 10, borderTop: line }}>
                <button type="button" onClick={() => setColumnsOpen(false)} style={footerBtn(false)}>
                  Cancel
                </button>
                <button type="button" onClick={() => setColumnsOpen(false)} style={footerBtn(true)}>
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#F5F5F5", borderBottom: line }}>
              <th style={{ ...thStyle, width: 40 }}>
                <input
                  type="checkbox"
                  checked={contacts.length > 0 && selected.size === contacts.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th style={{ ...thStyle, width: 72 }} />
              {columnDefs.map((col) => (
                <th key={col.id} style={{ ...thStyle, minWidth: col.minWidth }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columnDefs.length + 2} style={{ padding: 24, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && contacts.length === 0 && (
              <tr>
                <td colSpan={columnDefs.length + 2} style={{ padding: 24, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted }}>
                  No contacts match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              contacts.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelectContact(row.id)}
                  style={{ borderBottom: line, cursor: "pointer", background: selected.has(row.id) ? "rgba(59,130,246,0.04)" : "#fff" }}
                  onMouseEnter={(e) => {
                    if (!selected.has(row.id)) e.currentTarget.style.background = "#FAFAFA";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = selected.has(row.id) ? "rgba(59,130,246,0.04)" : "#fff";
                  }}
                >
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        });
                      }}
                    />
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        title={mailConnected ? "Send email" : "Connect inbox to email"}
                        disabled={!mailConnected}
                        onClick={() => mailConnected && onComposeTo?.(row.email)}
                        style={iconBtn(!mailConnected)}
                      >
                        ✉
                      </button>
                      {row.phone ? (
                        <a
                          href={`tel:${row.phone.replace(/\s/g, "")}`}
                          title={`Call ${row.phone}`}
                          style={{ ...iconBtn(false), display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: color.ink }}
                        >
                          📞
                        </a>
                      ) : (
                        <button type="button" disabled style={iconBtn(true)} title="No phone number">
                          📞
                        </button>
                      )}
                    </div>
                  </td>
                  {columnDefs.map((col) => (
                    <td key={col.id} style={tdStyle}>
                      {col.id === "status" && !visibleColumns.includes("status") ? null : renderCell(col.id, row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderTop: line,
          background: "#FAFAFA",
        }}
      >
        <span style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>
          Page {page} of {totalPages}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={pageBtn(page <= 1)}>
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={pageBtn(page >= totalPages)}
          >
            Next
          </button>
        </div>
      </div>

      <InboxLeadsFilterDrawer
        open={filterOpen}
        filters={filters}
        onClose={() => setFilterOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
    </div>
  );
}

function CellText({ value, truncate }: { value: string | null | undefined; truncate?: boolean }) {
  return (
    <span
      style={{
        fontFamily: fontSans,
        fontSize: T.bodySm,
        color: value ? color.ink : color.muted,
        overflow: truncate ? "hidden" : undefined,
        textOverflow: truncate ? "ellipsis" : undefined,
        whiteSpace: truncate ? "nowrap" : undefined,
        display: "block",
      }}
    >
      {value ?? "—"}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  textAlign: "left",
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 700,
  color: color.muted,
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 1,
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  verticalAlign: "middle",
  overflow: "hidden",
};

const popoverStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  right: 0,
  background: "#fff",
  border: "var(--scout-border)",
  borderRadius: 10,
  boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
  padding: 12,
  zIndex: 50,
  minWidth: 200,
};

function toolbarBtn(active: boolean): React.CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: 8,
    border: active ? "1px solid #2563EB" : "1px solid rgba(0,0,0,0.12)",
    background: active ? "rgba(59,130,246,0.08)" : "#fff",
    fontFamily: fontSans,
    fontSize: T.bodySm,
    fontWeight: 600,
    color: active ? "#1D4ED8" : color.ink,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function menuItem(active: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    border: "none",
    borderRadius: 6,
    background: active ? "rgba(59,130,246,0.08)" : "transparent",
    fontFamily: fontSans,
    fontSize: 13,
    cursor: "pointer",
    color: color.ink,
  };
}

function footerBtn(primary: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 6,
    border: "none",
    background: primary ? "#2563EB" : "transparent",
    color: primary ? "#fff" : color.muted,
    fontFamily: fontSans,
    fontSize: T.bodySm,
    fontWeight: 600,
    cursor: "pointer",
  };
}

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
    fontFamily: fontSans,
    fontSize: T.bodySm,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}

function iconBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: "1px solid rgba(0,0,0,0.1)",
    background: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    fontSize: 13,
  };
}

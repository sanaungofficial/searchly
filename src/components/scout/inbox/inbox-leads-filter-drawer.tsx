"use client";

import { useMemo, useState, useEffect, type CSSProperties } from "react";
import type { ContactListFilter } from "@/lib/inbox-crm/list-contacts";
import { INBOX_CONTACT_STATUSES } from "@/lib/inbox-crm/contact-status";
import { INBOX_USER_TAGS } from "@/lib/email-sender-display";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type FilterFieldDef = {
  category: ContactListFilter["category"];
  field: string;
  label: string;
  type: "text" | "status" | "source" | "boolean" | "date" | "jobStage" | "activityTag";
};

const FILTER_FIELDS: FilterFieldDef[] = [
  { category: "contact", field: "name", label: "Name", type: "text" },
  { category: "contact", field: "email", label: "Email address", type: "text" },
  { category: "contact", field: "company", label: "Company", type: "text" },
  { category: "contact", field: "title", label: "Title", type: "text" },
  { category: "contact", field: "status", label: "Status", type: "status" },
  { category: "contact", field: "source", label: "Source", type: "source" },
  { category: "contact", field: "contacted", label: "Contacted (import flag)", type: "boolean" },
  { category: "contact", field: "hasLinkedJob", label: "Has linked opportunity", type: "boolean" },
  { category: "contact", field: "createdAt", label: "Date created", type: "date" },
  { category: "contact", field: "updatedAt", label: "Date updated", type: "date" },
  { category: "activity", field: "lastActivityAt", label: "Latest communication date", type: "date" },
  { category: "activity", field: "hasEmail", label: "Has email activity", type: "boolean" },
  { category: "activity", field: "hasMeeting", label: "Has meeting activity", type: "boolean" },
  { category: "activity", field: "activityTag", label: "Email tag", type: "activityTag" },
  { category: "opportunity", field: "jobCompany", label: "Opportunity company", type: "text" },
  { category: "opportunity", field: "jobStage", label: "Opportunity stage", type: "jobStage" },
];

const CATEGORIES: { id: ContactListFilter["category"]; label: string; icon: string }[] = [
  { id: "contact", label: "Contacts", icon: "🏢" },
  { id: "activity", label: "Activity", icon: "✉️" },
  { id: "opportunity", label: "Opportunities", icon: "🏆" },
];

const JOB_STAGES = ["SAVED", "APPLYING", "APPLIED", "SCREENING", "INTERVIEWING", "OFFER", "REJECTED", "WITHDRAWN"];

type Props = {
  open: boolean;
  filters: ContactListFilter[];
  onClose: () => void;
  onApply: (filters: ContactListFilter[]) => void;
};

export function InboxLeadsFilterDrawer({ open, filters, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<ContactListFilter[]>(filters);
  const [view, setView] = useState<"categories" | "fields" | "configure">("categories");
  const [activeCategory, setActiveCategory] = useState<ContactListFilter["category"] | null>(null);
  const [configuring, setConfiguring] = useState<FilterFieldDef | null>(null);
  const [configValue, setConfigValue] = useState("");
  const [configOp, setConfigOp] = useState<"contains" | "eq" | "gte" | "lte" | "is_true" | "is_false">("contains");
  const [search, setSearch] = useState("");

  const filteredFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cat = activeCategory;
    return FILTER_FIELDS.filter((f) => {
      if (cat && f.category !== cat) return false;
      if (!q) return true;
      return f.label.toLowerCase().includes(q);
    });
  }, [activeCategory, search]);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  if (!open) return null;

  const line = "var(--scout-border)";

  function resetDrawer() {
    setView("categories");
    setActiveCategory(null);
    setConfiguring(null);
    setSearch("");
  }

  function openCategory(cat: ContactListFilter["category"]) {
    setActiveCategory(cat);
    setView("fields");
    setSearch("");
  }

  function startConfigure(field: FilterFieldDef) {
    setConfiguring(field);
    setConfigValue("");
    if (field.type === "boolean") setConfigOp("is_true");
    else if (field.type === "date") setConfigOp("gte");
    else if (field.type === "status" || field.type === "source" || field.type === "activityTag" || field.type === "jobStage")
      setConfigOp("eq");
    else setConfigOp("contains");
    setView("configure");
  }

  function addConfiguredFilter() {
    if (!configuring) return;
    let filter: ContactListFilter | null = null;

    if (configuring.type === "boolean") {
      filter = {
        category: configuring.category,
        field: configuring.field,
        operator: configOp === "is_false" ? "is_false" : "is_true",
      };
    } else if (configuring.type === "date") {
      if (!configValue) return;
      filter = {
        category: configuring.category,
        field: configuring.field,
        operator: configOp === "lte" ? "lte" : "gte",
        value: new Date(configValue).toISOString(),
      };
    } else {
      if (!configValue.trim()) return;
      filter = {
        category: configuring.category,
        field: configuring.field,
        operator: configOp,
        value: configValue.trim(),
      };
    }

    setDraft((prev) => [...prev, filter!]);
    resetDrawer();
  }

  function removeFilter(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function filterLabel(f: ContactListFilter): string {
    const def = FILTER_FIELDS.find((d) => d.category === f.category && d.field === f.field);
    const name = def?.label ?? f.field;
    if (f.operator === "is_true") return `${name}: Yes`;
    if (f.operator === "is_false") return `${name}: No`;
    if (f.field === "status" && typeof f.value === "string") {
      const s = INBOX_CONTACT_STATUSES.find((x) => x.id === f.value);
      return `${name}: ${s?.label ?? f.value}`;
    }
    if (f.operator === "gte") return `${name} ≥ ${formatShortDate(f.value as string)}`;
    if (f.operator === "lte") return `${name} ≤ ${formatShortDate(f.value as string)}`;
    return `${name}: ${f.value}`;
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.2)", zIndex: 200 }} />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(400px, 92vw)",
          background: surface.card,
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: line, display: "flex", alignItems: "center", gap: 10 }}>
          {view !== "categories" && (
            <button
              type="button"
              onClick={() => {
                if (view === "configure") {
                  setView("fields");
                  setConfiguring(null);
                } else {
                  resetDrawer();
                }
              }}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: color.muted }}
            >
              ←
            </button>
          )}
          <h3 style={{ margin: 0, flex: 1, fontFamily: fontSans, fontSize: 16, fontWeight: 700, color: color.ink }}>
            {view === "categories" && "Filters"}
            {view === "fields" && CATEGORIES.find((c) => c.id === activeCategory)?.label}
            {view === "configure" && configuring?.label}
          </h3>
          <button type="button" onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 22, color: color.muted }}>
            ×
          </button>
        </div>

        {draft.length > 0 && view === "categories" && (
          <div style={{ padding: "10px 16px", borderBottom: line, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {draft.map((f, i) => (
              <span
                key={`${f.category}-${f.field}-${i}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "rgba(59,130,246,0.1)",
                  fontFamily: fontSans,
                  fontSize: 11,
                  color: "#1D4ED8",
                }}
              >
                {filterLabel(f)}
                <button type="button" onClick={() => removeFilter(i)} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ padding: "12px 16px", borderBottom: line }}>
          <input
            type="search"
            placeholder="Find a filter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              border: line,
              borderRadius: 8,
              fontFamily: fontSans,
              fontSize: T.bodySm,
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {view === "categories" &&
            CATEGORIES.filter((c) => !search.trim() || c.label.toLowerCase().includes(search.toLowerCase())).map(
              (cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => openCategory(cat.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "14px 16px",
                    border: "none",
                    borderBottom: line,
                    background: "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{ flex: 1, fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink }}>
                    {cat.label}
                  </span>
                  <span style={{ color: color.muted }}>→</span>
                </button>
              ),
            )}

          {view === "fields" &&
            filteredFields.map((field) => (
              <button
                key={`${field.category}-${field.field}`}
                type="button"
                onClick={() => startConfigure(field)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: line,
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: fontSans,
                  fontSize: 13,
                  color: color.ink,
                }}
              >
                <span style={{ color: color.muted, fontSize: 11, width: 16 }}>T</span>
                {field.label}
              </button>
            ))}

          {view === "configure" && configuring && (
            <div style={{ padding: 16 }}>
              {configuring.type === "text" && (
                <label style={{ display: "block", fontFamily: fontSans, fontSize: 11, color: color.muted }}>
                  Contains
                  <input
                    value={configValue}
                    onChange={(e) => setConfigValue(e.target.value)}
                    autoFocus
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: 6,
                      padding: "9px 12px",
                      border: line,
                      borderRadius: 8,
                      fontFamily: fontSans,
                      fontSize: 13,
                    }}
                  />
                </label>
              )}
              {configuring.type === "status" && (
                <select
                  value={configValue}
                  onChange={(e) => setConfigValue(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: line, borderRadius: 8, fontFamily: fontSans, fontSize: 13 }}
                >
                  <option value="">Select status…</option>
                  {INBOX_CONTACT_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.label}
                    </option>
                  ))}
                </select>
              )}
              {configuring.type === "source" && (
                <select
                  value={configValue}
                  onChange={(e) => setConfigValue(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: line, borderRadius: 8, fontFamily: fontSans, fontSize: 13 }}
                >
                  <option value="">Select source…</option>
                  <option value="EMAIL">Email</option>
                  <option value="MANUAL">Import</option>
                  <option value="NYLAS">Address book</option>
                </select>
              )}
              {configuring.type === "activityTag" && (
                <select
                  value={configValue}
                  onChange={(e) => setConfigValue(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: line, borderRadius: 8, fontFamily: fontSans, fontSize: 13 }}
                >
                  <option value="">Select tag…</option>
                  {INBOX_USER_TAGS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
              )}
              {configuring.type === "jobStage" && (
                <select
                  value={configValue}
                  onChange={(e) => setConfigValue(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: line, borderRadius: 8, fontFamily: fontSans, fontSize: 13 }}
                >
                  <option value="">Select stage…</option>
                  {JOB_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
              {configuring.type === "boolean" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => setConfigOp("is_true")} style={toggleBtn(configOp === "is_true")}>
                    Yes
                  </button>
                  <button type="button" onClick={() => setConfigOp("is_false")} style={toggleBtn(configOp === "is_false")}>
                    No
                  </button>
                </div>
              )}
              {configuring.type === "date" && (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button type="button" onClick={() => setConfigOp("gte")} style={toggleBtn(configOp === "gte")}>
                      On or after
                    </button>
                    <button type="button" onClick={() => setConfigOp("lte")} style={toggleBtn(configOp === "lte")}>
                      On or before
                    </button>
                  </div>
                  <input
                    type="date"
                    value={configValue}
                    onChange={(e) => setConfigValue(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", border: line, borderRadius: 8, fontFamily: fontSans, fontSize: 13 }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px", borderTop: line, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {view === "configure" ? (
            <>
              <button type="button" onClick={resetDrawer} style={footerBtn(false)}>
                Cancel
              </button>
              <button type="button" onClick={addConfiguredFilter} style={footerBtn(true)}>
                Add filter
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} style={footerBtn(false)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(draft);
                  onClose();
                }}
                style={footerBtn(true)}
              >
                Done
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function toggleBtn(active: boolean): CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 8,
    border: active ? "1px solid #2563EB" : "1px solid rgba(0,0,0,0.12)",
    background: active ? "rgba(59,130,246,0.1)" : "#fff",
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    color: active ? "#1D4ED8" : color.ink,
  };
}

function footerBtn(primary: boolean): CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: primary ? "#2563EB" : "transparent",
    color: primary ? "#fff" : color.muted,
    fontFamily: fontSans,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface TrackedCompany {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  type: string | null;
  hqLocation: string | null;
  priority: string | null;
  cultureMission: string | null;
  candidateEdge: string | null;
  targetRoles: string | null;
  createdAt: string;
}

type Field = keyof Omit<TrackedCompany, "id" | "createdAt">;

const PRIORITY_OPTIONS = ["HIGH", "MEDIUM", "LOW"];

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function getColor(name: string): string {
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f97316","#10b981","#0ea5e9","#f43f5e","#84cc16"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function AutoTextarea({
  value,
  placeholder,
  onBlur,
}: {
  value: string;
  placeholder: string;
  onBlur: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocal(value); }, [value]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [local]);

  return (
    <textarea
      ref={ref}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onBlur(local)}
      placeholder={placeholder}
      rows={1}
      style={{
        width: "100%",
        fontFamily: "var(--font-dm-sans), system-ui",
        fontSize: 12,
        color: "#1a1a1a",
        background: "transparent",
        border: "none",
        outline: "none",
        resize: "none",
        lineHeight: 1.55,
        padding: 0,
        overflow: "hidden",
      }}
    />
  );
}

function InlineInput({
  value,
  placeholder,
  onBlur,
  mono,
}: {
  value: string;
  placeholder: string;
  onBlur: (v: string) => void;
  mono?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onBlur(local)}
      placeholder={placeholder}
      style={{
        width: "100%",
        fontFamily: mono ? "monospace" : "var(--font-dm-sans), system-ui",
        fontSize: 12,
        color: "#1a1a1a",
        background: "transparent",
        border: "none",
        outline: "none",
        padding: 0,
      }}
    />
  );
}

function PriorityBadge({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const color = value === "HIGH" ? { bg: "#fef2f2", text: "#dc2626" }
    : value === "MEDIUM" ? { bg: "#fffbeb", text: "#d97706" }
    : value === "LOW" ? { bg: "#f0fdf4", text: "#16a34a" }
    : { bg: "#f3f4f6", text: "#6b7280" };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: color.bg,
          color: color.text,
          border: "none",
          borderRadius: 5,
          padding: "3px 8px",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
        }}
      >
        {value || "—"}
      </button>
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          zIndex: 100,
          minWidth: 100,
          overflow: "hidden",
        }}>
          {["HIGH", "MEDIUM", "LOW", ""].map((opt) => (
            <button
              key={opt || "none"}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                background: value === opt ? "#f3f4f6" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: opt ? 600 : 400,
                color: opt === "HIGH" ? "#dc2626" : opt === "MEDIUM" ? "#d97706" : opt === "LOW" ? "#16a34a" : "#6b7280",
              }}
            >
              {opt || "None"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkspaceCompanies() {
  const [companies, setCompanies] = useState<TrackedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) setCompanies(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setCompanies((prev) => [created, ...prev]);
        setNewName("");
        setShowAdd(false);
      }
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function patchField(id: string, field: Field, value: string) {
    const trimmed = value.trim();
    setCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: trimmed || null } : c))
    );
    await fetch(`/api/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: trimmed || null }),
    });
  }

  async function handleRemove(id: string) {
    try {
      await fetch(`/api/companies/${id}`, { method: "DELETE" });
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  }

  const COL_WIDTHS = {
    company: 160,
    type: 140,
    hq: 130,
    priority: 90,
    culture: 220,
    edge: 220,
    roles: 160,
    actions: 60,
  };

  const thStyle: React.CSSProperties = {
    fontFamily: "var(--font-dm-sans), system-ui",
    fontSize: 10,
    fontWeight: 600,
    color: "#A09890",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "10px 14px",
    textAlign: "left",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #e8e3dd",
    background: "#faf8f5",
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 14px",
    verticalAlign: "top",
    borderBottom: "1px solid #f0ebe4",
  };

  return (
    <div style={{ padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontWeight: 600, fontSize: 16, color: "#1a1a1a" }}>
            Tracked Companies
          </div>
          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", color: "#A09890", fontSize: 13, marginTop: 2 }}>
            {companies.length} {companies.length === 1 ? "company" : "companies"} on your watchlist
          </div>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          style={{
            background: showAdd ? "#f3f4f6" : "#1a1a1a",
            color: showAdd ? "#1a1a1a" : "#fff",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans), system-ui",
          }}
        >
          {showAdd ? "Cancel" : "+ Track company"}
        </button>
      </div>

      {/* Quick-add form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "16px 20px",
            marginBottom: 20,
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 5 }}>
              Company name *
            </label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Comcast, Aramark, Deloitte"
              style={{
                width: "100%",
                border: "1px solid #e5e7eb",
                borderRadius: 7,
                padding: "7px 11px",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "var(--font-dm-sans), system-ui",
              }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            style={{
              background: "#1a1a1a",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "7px 18px",
              fontSize: 13,
              fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving || !newName.trim() ? 0.5 : 1,
              fontFamily: "var(--font-dm-sans), system-ui",
            }}
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ color: "#A09890", fontSize: 13, padding: "48px 0", textAlign: "center", fontFamily: "var(--font-dm-sans), system-ui" }}>
          Loading…
        </div>
      ) : companies.length === 0 ? (
        <div style={{
          background: "#fff",
          border: "1.5px dashed #d1d5db",
          borderRadius: 12,
          padding: "48px 32px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontWeight: 600, fontSize: 14, color: "#1a1a1a", marginBottom: 6 }}>
            No companies tracked yet
          </div>
          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", color: "#A09890", fontSize: 13 }}>
            Add companies you want to monitor for open roles and signals.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e8e3dd" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: COL_WIDTHS.company }}>Company</th>
                <th style={{ ...thStyle, width: COL_WIDTHS.type }}>Type</th>
                <th style={{ ...thStyle, width: COL_WIDTHS.hq }}>HQ / Location</th>
                <th style={{ ...thStyle, width: COL_WIDTHS.priority }}>Priority</th>
                <th style={{ ...thStyle, width: COL_WIDTHS.culture }}>Culture & Mission</th>
                <th style={{ ...thStyle, width: COL_WIDTHS.edge }}>Candidate's Edge</th>
                <th style={{ ...thStyle, width: COL_WIDTHS.roles }}>Target Roles</th>
                <th style={{ ...thStyle, width: COL_WIDTHS.actions }}></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => {
                const color = getColor(c.name);
                const initials = getInitials(c.name);
                const isLast = i === companies.length - 1;
                const rowTd: React.CSSProperties = {
                  ...tdStyle,
                  borderBottom: isLast ? "none" : tdStyle.borderBottom,
                };
                return (
                  <tr key={c.id} style={{ background: "#fff" }}>
                    {/* Company */}
                    <td style={rowTd}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 7,
                          background: color, display: "flex", alignItems: "center",
                          justifyContent: "center", color: "#fff",
                          fontWeight: 700, fontSize: 11, flexShrink: 0,
                        }}>
                          {initials}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <InlineInput
                            value={c.name}
                            placeholder="Company name"
                            onBlur={(v) => v.trim() && patchField(c.id, "name", v)}
                          />
                          <InlineInput
                            value={c.website ?? ""}
                            placeholder="Website URL"
                            onBlur={(v) => patchField(c.id, "website", v)}
                            mono
                          />
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td style={rowTd}>
                      <AutoTextarea
                        value={c.type ?? ""}
                        placeholder="e.g. Media / Technology / Corporate"
                        onBlur={(v) => patchField(c.id, "type", v)}
                      />
                    </td>

                    {/* HQ / Location */}
                    <td style={rowTd}>
                      <InlineInput
                        value={c.hqLocation ?? ""}
                        placeholder="e.g. Philadelphia, PA"
                        onBlur={(v) => patchField(c.id, "hqLocation", v)}
                      />
                    </td>

                    {/* Priority */}
                    <td style={rowTd}>
                      <PriorityBadge
                        value={c.priority ?? ""}
                        onChange={(v) => patchField(c.id, "priority", v)}
                      />
                    </td>

                    {/* Culture & Mission */}
                    <td style={rowTd}>
                      <AutoTextarea
                        value={c.cultureMission ?? ""}
                        placeholder="Describe culture and mission…"
                        onBlur={(v) => patchField(c.id, "cultureMission", v)}
                      />
                    </td>

                    {/* Candidate's Edge */}
                    <td style={rowTd}>
                      <AutoTextarea
                        value={c.candidateEdge ?? ""}
                        placeholder="Why you're a strong fit…"
                        onBlur={(v) => patchField(c.id, "candidateEdge", v)}
                      />
                    </td>

                    {/* Target Roles */}
                    <td style={rowTd}>
                      <AutoTextarea
                        value={c.targetRoles ?? ""}
                        placeholder="e.g. Director Business Operations…"
                        onBlur={(v) => patchField(c.id, "targetRoles", v)}
                      />
                    </td>

                    {/* Actions */}
                    <td style={{ ...rowTd, textAlign: "center" }}>
                      <button
                        onClick={() => handleRemove(c.id)}
                        title="Remove company"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ccc",
                          fontSize: 16,
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: 5,
                          lineHeight: 1,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#ccc")}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

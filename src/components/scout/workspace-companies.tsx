"use client";

import { useState, useEffect, useCallback } from "react";

interface TrackedCompany {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  createdAt: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getColor(name: string): string {
  const colors = [
    "#6366f1", "#8b5cf6", "#ec4899", "#f97316",
    "#10b981", "#0ea5e9", "#f43f5e", "#84cc16",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function WorkspaceCompanies() {
  const [companies, setCompanies] = useState<TrackedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), website: website.trim() || null }),
      });
      if (res.ok) {
        const created = await res.json();
        setCompanies((prev) => [created, ...prev]);
        setName("");
        setWebsite("");
        setShowAdd(false);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await fetch(`/api/companies/${id}`, { method: "DELETE" });
      setCompanies((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 17, color: "#1a1a1a" }}>Tracked Companies</div>
          <div style={{ color: "#888", fontSize: 14, marginTop: 2 }}>
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
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {showAdd ? "Cancel" : "+ Track company"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 24,
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>
              Company name *
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stripe, Notion, Figma"
              style={{
                width: "100%",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
              required
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>
              Website (optional)
            </label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://stripe.com"
              style={{
                width: "100%",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            style={{
              background: "#1a1a1a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving || !name.trim() ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {saving ? "Adding..." : "Add"}
          </button>
        </form>
      )}

      {loading ? (
        <div style={{ color: "#888", fontSize: 14, padding: "40px 0", textAlign: "center" }}>Loading...</div>
      ) : companies.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1.5px dashed #d1d5db",
            borderRadius: 12,
            padding: "48px 32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a", marginBottom: 6 }}>
            No companies tracked yet
          </div>
          <div style={{ color: "#888", fontSize: 14 }}>
            Add companies you want to monitor for open roles and signals.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {companies.map((company) => {
            const color = getColor(company.name);
            const initials = getInitials(company.name);
            const isHovered = hoveredId === company.id;
            const linkedinUrl = `https://www.linkedin.com/company/${encodeURIComponent(company.name.toLowerCase().replace(/\s+/g, "-"))}/jobs/`;
            return (
              <div
                key={company.id}
                onMouseEnter={() => setHoveredId(company.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "20px",
                  position: "relative",
                  transition: "box-shadow 0.15s",
                  boxShadow: isHovered ? "0 4px 16px rgba(0,0,0,0.08)" : "none",
                }}
              >
                {isHovered && (
                  <button
                    onClick={() => handleRemove(company.id)}
                    title="Remove"
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "#fee2e2",
                      color: "#dc2626",
                      border: "none",
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {company.name}
                    </div>
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13, color: "#6366f1", textDecoration: "none" }}
                      >
                        {company.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {company.website && (
                    <a
                      href={`${company.website.replace(/\/$/, "")}/jobs`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 13,
                        color: "#1a1a1a",
                        background: "#f3f4f6",
                        border: "none",
                        borderRadius: 6,
                        padding: "5px 10px",
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      View jobs →
                    </a>
                  )}
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 13,
                      color: "#0a66c2",
                      background: "#eff6ff",
                      border: "none",
                      borderRadius: 6,
                      padding: "5px 10px",
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    LinkedIn jobs →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

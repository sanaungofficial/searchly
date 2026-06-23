"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface CachedJob {
  title: string;
  location: string | null;
  department: string | null;
  url: string | null;
}

interface JobsCache {
  jobs: CachedJob[];
  scanned_url: string;
}

interface EnrichmentLeader { name: string; title: string; }
interface EnrichmentNews { title: string; date: string; summary: string; }
interface EnrichmentCache {
  description: string | null;
  founded: string | null;
  headquarters: string | null;
  employeeCount: string | null;
  industry: string | null;
  fundingStage: string | null;
  totalFunding: string | null;
  keyInvestors: string[];
  leadership: EnrichmentLeader[];
  recentNews: EnrichmentNews[];
  glassdoorRating: string | null;
  websiteUrl: string | null;
}

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
  careersUrl: string | null;
  jobsCache: JobsCache | null;
  lastJobsFetchedAt: string | null;
  enrichmentCache: EnrichmentCache | null;
  enrichmentFetchedAt: string | null;
  createdAt: string;
}

type Field = keyof Omit<TrackedCompany, "id" | "createdAt" | "jobsCache" | "lastJobsFetchedAt">;

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function getColor(name: string): string {
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f97316","#10b981","#0ea5e9","#f43f5e","#84cc16"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isJobMatch(jobTitle: string, userTargetRoles: string[]): boolean {
  if (!userTargetRoles.length) return false;
  const title = jobTitle.toLowerCase();
  return userTargetRoles.some((role) =>
    role.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => title.includes(w))
  );
}

const editableWrapStyle: React.CSSProperties = {
  borderRadius: 6,
  padding: "4px 6px",
  margin: "-4px -6px",
  transition: "background 0.15s",
  cursor: "text",
};

function AutoTextarea({ value, placeholder, onBlur }: { value: string; placeholder: string; onBlur: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => {
    if (ref.current) { ref.current.style.height = "auto"; ref.current.style.height = ref.current.scrollHeight + "px"; }
  }, [local]);
  return (
    <div style={{ ...editableWrapStyle, background: focused ? "#fff" : hovered ? "#f5f3f0" : "transparent", outline: focused ? "1.5px solid #c5b9af" : "none" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <textarea ref={ref} value={local} onChange={(e) => setLocal(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); onBlur(local); }} placeholder={placeholder} rows={1} style={{ width: "100%", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#1a1a1a", background: "transparent", border: "none", outline: "none", resize: "none", lineHeight: 1.55, padding: 0, overflow: "hidden" }} />
    </div>
  );
}

function InlineInput({ value, placeholder, onBlur, mono, bold }: { value: string; placeholder: string; onBlur: (v: string) => void; mono?: boolean; bold?: boolean }) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <div style={{ ...editableWrapStyle, background: focused ? "#fff" : hovered ? "#f5f3f0" : "transparent", outline: focused ? "1.5px solid #c5b9af" : "none" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <input value={local} onChange={(e) => setLocal(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); onBlur(local); }} placeholder={placeholder} style={{ width: "100%", fontFamily: mono ? "monospace" : "var(--font-dm-sans), system-ui", fontSize: mono ? 11 : 12, fontWeight: bold ? 600 : 400, color: mono ? "#6b7280" : "#1a1a1a", background: "transparent", border: "none", outline: "none", padding: 0 }} />
    </div>
  );
}

function PriorityBadge({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) { if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const color = value === "HIGH" ? { bg: "#fef2f2", text: "#dc2626" } : value === "MEDIUM" ? { bg: "#fffbeb", text: "#d97706" } : value === "LOW" ? { bg: "#f0fdf4", text: "#16a34a" } : { bg: "#f3f4f6", text: "#6b7280" };
  function handleOpen() {
    if (btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setCoords({ top: r.bottom + 4, left: r.left }); }
    setOpen((o) => !o);
  }
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button ref={btnRef} onClick={handleOpen} style={{ background: color.bg, color: color.text, border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{value || "—"}</button>
      {open && (
        <div style={{ position: "fixed", top: coords.top, left: coords.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 100, overflow: "hidden" }}>
          {["HIGH", "MEDIUM", "LOW", ""].map((opt) => (
            <button key={opt || "none"} onClick={() => { onChange(opt); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: value === opt ? "#f3f4f6" : "transparent", border: "none", cursor: "pointer", fontSize: 12, fontWeight: opt ? 600 : 400, color: opt === "HIGH" ? "#dc2626" : opt === "MEDIUM" ? "#d97706" : opt === "LOW" ? "#16a34a" : "#6b7280" }}>{opt || "None"}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function JobsCell({ company, onRefreshed }: { company: TrackedCompany; onRefreshed: (updated: TrackedCompany) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = company.jobsCache as JobsCache | null;
  const jobCount = cache?.jobs?.length ?? 0;
  const hasJobs = jobCount > 0;

  async function handleRefresh() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/refresh`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Scan failed."); } else { onRefreshed(data); }
    } catch { setError("Network error."); } finally { setLoading(false); }
  }

  return (
    <div style={{ minWidth: 160 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {hasJobs && (
          <span style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
            {jobCount} {jobCount === 1 ? "role" : "roles"}
          </span>
        )}
        <button onClick={handleRefresh} disabled={loading} title="Scan careers page for open roles" style={{ background: loading ? "#f3f4f6" : "transparent", color: loading ? "#9ca3af" : "#6b7280", border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-dm-sans), system-ui" }}>
          {loading ? "Scanning…" : hasJobs ? "↻ Refresh" : "Scan jobs"}
        </button>
      </div>
      {company.lastJobsFetchedAt && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, fontFamily: "var(--font-dm-sans), system-ui" }}>{timeAgo(company.lastJobsFetchedAt)}</div>}
      {error && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4, lineHeight: 1.4, fontFamily: "var(--font-dm-sans), system-ui" }}>{error}</div>}
    </div>
  );
}

// ── Company Detail Drawer ────────────────────────────────────────────────────

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 700, color: "#A09890", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 500, color: "#A09890", marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

function CompanyDrawer({
  company,
  userTargetRoles,
  onClose,
  onPatch,
  onRefreshed,
  onRemove,
}: {
  company: TrackedCompany;
  userTargetRoles: string[];
  onClose: () => void;
  onPatch: (id: string, field: Field, value: string) => void;
  onRefreshed: (updated: TrackedCompany) => void;
  onRemove: (id: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const color = getColor(company.name);
  const initials = getInitials(company.name);
  const cache = company.jobsCache as JobsCache | null;
  const jobs = cache?.jobs ?? [];
  const intel = company.enrichmentCache as EnrichmentCache | null;

  async function handleEnrich() {
    setEnriching(true); setEnrichError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/enrich`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setEnrichError(data.error ?? "Enrichment failed."); } else { onRefreshed(data); }
    } catch { setEnrichError("Network error."); } finally { setEnriching(false); }
  }

  // Sort: matched jobs first
  const sorted = [...jobs].sort((a, b) => {
    const aMatch = isJobMatch(a.title, userTargetRoles) ? 0 : 1;
    const bMatch = isJobMatch(b.title, userTargetRoles) ? 0 : 1;
    return aMatch - bMatch;
  });

  async function handleScan() {
    setScanning(true); setScanError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/refresh`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setScanError(data.error ?? "Scan failed."); } else { onRefreshed(data); }
    } catch { setScanError("Network error."); } finally { setScanning(false); }
  }

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 200, backdropFilter: "blur(1px)" }} />

      {/* Drawer */}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 480, background: "#fff", zIndex: 201, boxShadow: "-8px 0 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f0ebe4", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <InlineInput value={company.name} placeholder="Company name" onBlur={(v) => v.trim() && onPatch(company.id, "name", v)} bold />
                <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  {company.website && <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280", textDecoration: "none" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>↗ Website</a>}
                  {company.careersUrl && <a href={company.careersUrl.startsWith("http") ? company.careersUrl : `https://${company.careersUrl}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280", textDecoration: "none" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>↗ Careers</a>}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
              <PriorityBadge value={company.priority ?? ""} onChange={(v) => onPatch(company.id, "priority", v)} />
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#aaa", cursor: "pointer", padding: "2px 6px", borderRadius: 5, lineHeight: 1 }} onMouseEnter={(e) => (e.currentTarget.style.color = "#333")} onMouseLeave={(e) => (e.currentTarget.style.color = "#aaa")}>×</button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto" }}>

          {/* Company Intel */}
          <DrawerSection title="Company Intel">
            {!intel ? (
              <div>
                <button onClick={handleEnrich} disabled={enriching} style={{ background: enriching ? "#f3f4f6" : "#1a1a1a", color: enriching ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: enriching ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans), system-ui", fontWeight: 500 }}>
                  {enriching ? "Researching…" : "✦ Enrich with AI"}
                </button>
                {enrichError && <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#dc2626", marginTop: 6 }}>{enrichError}</div>}
                <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#A09890", marginTop: 6 }}>Pulls company overview, funding, leadership, and recent news from AI.</div>
              </div>
            ) : (
              <div>
                {/* Description */}
                {intel.description && <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#374151", lineHeight: 1.6, margin: "0 0 14px 0" }}>{intel.description}</p>}

                {/* Quick stats row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {intel.founded && <span style={{ background: "#f3f4f6", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#374151", fontFamily: "var(--font-dm-sans), system-ui" }}>📅 Founded {intel.founded}</span>}
                  {intel.headquarters && <span style={{ background: "#f3f4f6", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#374151", fontFamily: "var(--font-dm-sans), system-ui" }}>📍 {intel.headquarters}</span>}
                  {intel.employeeCount && <span style={{ background: "#f3f4f6", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#374151", fontFamily: "var(--font-dm-sans), system-ui" }}>👥 {intel.employeeCount}</span>}
                  {intel.industry && <span style={{ background: "#f3f4f6", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#374151", fontFamily: "var(--font-dm-sans), system-ui" }}>{intel.industry}</span>}
                  {intel.glassdoorRating && <span style={{ background: "#f0fdf4", borderRadius: 5, padding: "3px 8px", fontSize: 11, color: "#16a34a", fontFamily: "var(--font-dm-sans), system-ui", fontWeight: 600 }}>★ {intel.glassdoorRating} Glassdoor</span>}
                </div>

                {/* Funding */}
                {(intel.fundingStage || intel.totalFunding || (intel.keyInvestors?.length > 0)) && (
                  <div style={{ background: "#faf8f5", border: "1px solid #e8e3dd", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
                    <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 700, color: "#A09890", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Funding</div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {intel.fundingStage && <div><div style={{ fontSize: 10, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui" }}>Stage</div><div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-dm-sans), system-ui" }}>{intel.fundingStage}</div></div>}
                      {intel.totalFunding && <div><div style={{ fontSize: 10, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui" }}>Total</div><div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-dm-sans), system-ui" }}>{intel.totalFunding}</div></div>}
                      {intel.keyInvestors?.length > 0 && <div><div style={{ fontSize: 10, color: "#A09890", fontFamily: "var(--font-dm-sans), system-ui" }}>Investors</div><div style={{ fontSize: 12, color: "#374151", fontFamily: "var(--font-dm-sans), system-ui" }}>{intel.keyInvestors.join(", ")}</div></div>}
                    </div>
                  </div>
                )}

                {/* Leadership */}
                {intel.leadership?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 700, color: "#A09890", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Leadership</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {intel.leadership.map((l, i) => (
                        <div key={i} style={{ background: "#fff", border: "1px solid #e8e3dd", borderRadius: 7, padding: "7px 12px", minWidth: 120 }}>
                          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>{l.name}</div>
                          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#6b7280" }}>{l.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent News */}
                {intel.recentNews?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 700, color: "#A09890", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Recent News</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {intel.recentNews.map((n, i) => (
                        <div key={i} style={{ background: "#faf8f5", border: "1px solid #e8e3dd", borderRadius: 7, padding: "8px 12px" }}>
                          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 500, color: "#1a1a1a" }}>{n.title}</div>
                          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#6b7280", marginTop: 2 }}>{n.summary} <span style={{ color: "#A09890" }}>· {n.date}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Re-enrich */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={handleEnrich} disabled={enriching} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 10px", cursor: enriching ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans), system-ui" }}>
                    {enriching ? "Refreshing…" : "↻ Refresh intel"}
                  </button>
                  {company.enrichmentFetchedAt && <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890" }}>Updated {timeAgo(company.enrichmentFetchedAt)}</span>}
                </div>
                {enrichError && <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#dc2626", marginTop: 6 }}>{enrichError}</div>}
                <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#d1d5db", marginTop: 6 }}>AI-generated · may not reflect latest data</div>
              </div>
            )}
          </DrawerSection>

          {/* Open Roles */}
          <DrawerSection title="Open Roles">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <button onClick={handleScan} disabled={scanning} style={{ background: scanning ? "#f3f4f6" : "#1a1a1a", color: scanning ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: scanning ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans), system-ui", fontWeight: 500 }}>
                {scanning ? "Scanning…" : jobs.length > 0 ? "↻ Re-scan" : "Scan for roles"}
              </button>
              {company.lastJobsFetchedAt && <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#A09890" }}>Last scanned {timeAgo(company.lastJobsFetchedAt)}</span>}
            </div>
            {scanError && <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#dc2626", marginBottom: 8, lineHeight: 1.4 }}>{scanError}</div>}

            {jobs.length === 0 && !scanning ? (
              <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#A09890", padding: "16px 0" }}>
                No roles cached yet. Add a careers URL and click &ldquo;Scan for roles&rdquo;.
              </div>
            ) : (
              <div style={{ border: "1px solid #e8e3dd", borderRadius: 8, overflow: "hidden" }}>
                {sorted.map((job, i) => {
                  const match = isJobMatch(job.title, userTargetRoles);
                  return (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: i < sorted.length - 1 ? "1px solid #f0ebe4" : "none", display: "flex", alignItems: "flex-start", gap: 10, background: match ? "#f9fffe" : "#fff" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {job.url ? (
                          <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, color: "#1a1a1a", textDecoration: "none", display: "block" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>{job.title}</a>
                        ) : (
                          <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{job.title}</span>
                        )}
                        {(job.department || job.location) && (
                          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            {[job.department, job.location].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                      {match && (
                        <span style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, marginTop: 2, fontFamily: "var(--font-dm-sans), system-ui", letterSpacing: "0.03em" }}>Match</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {jobs.length > 0 && userTargetRoles.length > 0 && (
              <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#A09890", marginTop: 8 }}>
                Matching against: {userTargetRoles.slice(0, 3).join(", ")}{userTargetRoles.length > 3 ? ` +${userTargetRoles.length - 3} more` : ""}
              </div>
            )}
          </DrawerSection>

          {/* Notes */}
          <DrawerSection title="Notes">
            <div style={{ background: "#faf8f5", border: "1px solid #e8e3dd", borderRadius: 8, padding: "10px 12px" }}>
              <AutoTextarea value={company.notes ?? ""} placeholder="Add notes about this company, contacts, conversations…" onBlur={(v) => onPatch(company.id, "notes", v)} />
            </div>
          </DrawerSection>

          {/* Details */}
          <DrawerSection title="Details">
            <DrawerField label="Type / Industry">
              <InlineInput value={company.type ?? ""} placeholder="e.g. Media / Technology" onBlur={(v) => onPatch(company.id, "type", v)} />
            </DrawerField>
            <DrawerField label="HQ / Location">
              <InlineInput value={company.hqLocation ?? ""} placeholder="e.g. Philadelphia, PA" onBlur={(v) => onPatch(company.id, "hqLocation", v)} />
            </DrawerField>
            <DrawerField label="Website">
              <InlineInput value={company.website ?? ""} placeholder="https://example.com" onBlur={(v) => onPatch(company.id, "website", v)} mono />
            </DrawerField>
            <DrawerField label="Careers URL">
              <InlineInput value={company.careersUrl ?? ""} placeholder="https://example.com/careers" onBlur={(v) => onPatch(company.id, "careersUrl", v)} mono />
            </DrawerField>
            <DrawerField label="Culture & Mission">
              <AutoTextarea value={company.cultureMission ?? ""} placeholder="What's their culture, values, or mission?" onBlur={(v) => onPatch(company.id, "cultureMission", v)} />
            </DrawerField>
            <DrawerField label="Your Edge">
              <AutoTextarea value={company.candidateEdge ?? ""} placeholder="Why are you a strong fit here?" onBlur={(v) => onPatch(company.id, "candidateEdge", v)} />
            </DrawerField>
            <DrawerField label="Target Roles at This Company">
              <AutoTextarea value={company.targetRoles ?? ""} placeholder="e.g. Director of Strategy, VP Operations…" onBlur={(v) => onPatch(company.id, "targetRoles", v)} />
            </DrawerField>
          </DrawerSection>

          {/* Danger zone */}
          <div style={{ borderTop: "1px solid #f0ebe4", paddingTop: 16 }}>
            <button onClick={() => { onRemove(company.id); onClose(); }} style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#dc2626", background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }} onMouseEnter={(e) => { (e.currentTarget.style.background = "#fef2f2"); }} onMouseLeave={(e) => { (e.currentTarget.style.background = "none"); }}>
              Remove company
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function WorkspaceCompanies() {
  const [companies, setCompanies] = useState<TrackedCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userTargetRoles, setUserTargetRoles] = useState<string[]>([]);

  const load = useCallback(async () => {
    try { const res = await fetch("/api/companies"); if (res.ok) setCompanies(await res.json()); } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.targetRoles)) setUserTargetRoles(d.targetRoles);
    }).catch(() => {});
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); if (!newName.trim()) return; setSaving(true);
    try {
      const res = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() }) });
      if (res.ok) { const created = await res.json(); setCompanies((prev) => [created, ...prev]); setNewName(""); setShowAdd(false); }
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function patchField(id: string, field: Field, value: string) {
    const trimmed = value.trim();
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: trimmed || null } : c)));
    await fetch(`/api/companies/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: trimmed || null }) });
  }

  async function handleRemove(id: string) {
    try { await fetch(`/api/companies/${id}`, { method: "DELETE" }); setCompanies((prev) => prev.filter((c) => c.id !== id)); } catch { /* ignore */ }
  }

  function handleRefreshed(updated: TrackedCompany) {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  const selectedCompany = companies.find((c) => c.id === selectedId) ?? null;

  const thStyle: React.CSSProperties = { fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 14px", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #e8e3dd", background: "#faf8f5" };
  const tdStyle: React.CSSProperties = { padding: "12px 14px", verticalAlign: "top", borderBottom: "1px solid #f0ebe4" };

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontWeight: 600, fontSize: 16, color: "#1a1a1a" }}>Tracked Companies</div>
          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", color: "#A09890", fontSize: 13, marginTop: 2 }}>{companies.length} {companies.length === 1 ? "company" : "companies"} on your watchlist</div>
        </div>
        <button onClick={() => setShowAdd((s) => !s)} style={{ background: showAdd ? "#f3f4f6" : "#1a1a1a", color: showAdd ? "#1a1a1a" : "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-dm-sans), system-ui" }}>
          {showAdd ? "Cancel" : "+ Track company"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 500, color: "#555", display: "block", marginBottom: 5 }}>Company name *</label>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Comcast, Aramark, Deloitte" style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 7, padding: "7px 11px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "var(--font-dm-sans), system-ui" }} required />
          </div>
          <button type="submit" disabled={saving || !newName.trim()} style={{ background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 7, padding: "7px 18px", fontSize: 13, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", opacity: saving || !newName.trim() ? 0.5 : 1, fontFamily: "var(--font-dm-sans), system-ui" }}>{saving ? "Adding…" : "Add"}</button>
        </form>
      )}

      {loading ? (
        <div style={{ color: "#A09890", fontSize: 13, padding: "48px 0", textAlign: "center", fontFamily: "var(--font-dm-sans), system-ui" }}>Loading…</div>
      ) : companies.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed #d1d5db", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontWeight: 600, fontSize: 14, color: "#1a1a1a", marginBottom: 6 }}>No companies tracked yet</div>
          <div style={{ fontFamily: "var(--font-dm-sans), system-ui", color: "#A09890", fontSize: 13 }}>Add companies you want to monitor for open roles and signals.</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e8e3dd" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 175 }}>Company</th>
                <th style={{ ...thStyle, width: 130 }}>Type</th>
                <th style={{ ...thStyle, width: 120 }}>HQ / Location</th>
                <th style={{ ...thStyle, width: 85 }}>Priority</th>
                <th style={{ ...thStyle, width: 200 }}>{"Culture & Mission"}</th>
                <th style={{ ...thStyle, width: 200 }}>{"Candidate's Edge"}</th>
                <th style={{ ...thStyle, width: 150 }}>Target Roles</th>
                <th style={{ ...thStyle, width: 170 }}>Open Roles</th>
                <th style={{ ...thStyle, width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => {
                const color = getColor(c.name);
                const initials = getInitials(c.name);
                const isLast = i === companies.length - 1;
                const rowTd: React.CSSProperties = { ...tdStyle, borderBottom: isLast ? "none" : tdStyle.borderBottom };
                const jobCount = (c.jobsCache as JobsCache | null)?.jobs?.length ?? 0;
                const matchCount = (c.jobsCache as JobsCache | null)?.jobs?.filter((j) => isJobMatch(j.title, userTargetRoles)).length ?? 0;
                return (
                  <tr key={c.id} style={{ background: selectedId === c.id ? "#faf8f5" : "#fff" }}>
                    <td style={rowTd}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                        {/* Avatar — click to open drawer */}
                        <button onClick={() => setSelectedId(selectedId === c.id ? null : c.id)} title="View company details" style={{ width: 30, height: 30, borderRadius: 7, background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 11, flexShrink: 0, marginTop: 2, border: selectedId === c.id ? "2px solid #1a1a1a" : "2px solid transparent", cursor: "pointer", padding: 0 }}>{initials}</button>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <InlineInput value={c.name} placeholder="Company name" onBlur={(v) => v.trim() && patchField(c.id, "name", v)} bold />
                          <InlineInput value={c.website ?? ""} placeholder="Website" onBlur={(v) => patchField(c.id, "website", v)} mono />
                          <InlineInput value={c.careersUrl ?? ""} placeholder="Careers URL" onBlur={(v) => patchField(c.id, "careersUrl", v)} mono />
                        </div>
                      </div>
                    </td>
                    <td style={rowTd}><AutoTextarea value={c.type ?? ""} placeholder="e.g. Media / Technology" onBlur={(v) => patchField(c.id, "type", v)} /></td>
                    <td style={rowTd}><InlineInput value={c.hqLocation ?? ""} placeholder="e.g. Philadelphia, PA" onBlur={(v) => patchField(c.id, "hqLocation", v)} /></td>
                    <td style={rowTd}><PriorityBadge value={c.priority ?? ""} onChange={(v) => patchField(c.id, "priority", v)} /></td>
                    <td style={rowTd}><AutoTextarea value={c.cultureMission ?? ""} placeholder="Describe culture and mission…" onBlur={(v) => patchField(c.id, "cultureMission", v)} /></td>
                    <td style={rowTd}><AutoTextarea value={c.candidateEdge ?? ""} placeholder="Why you're a strong fit…" onBlur={(v) => patchField(c.id, "candidateEdge", v)} /></td>
                    <td style={rowTd}><AutoTextarea value={c.targetRoles ?? ""} placeholder="e.g. Director Business Operations…" onBlur={(v) => patchField(c.id, "targetRoles", v)} /></td>
                    <td style={rowTd}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <JobsCell company={c} onRefreshed={handleRefreshed} />
                        {jobCount > 0 && matchCount > 0 && (
                          <button onClick={() => setSelectedId(c.id)} style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#16a34a", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", textDecoration: "underline" }}>
                            {matchCount} match{matchCount !== 1 ? "es" : ""} for your roles
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...rowTd, textAlign: "center" }}>
                      <button onClick={() => handleRemove(c.id)} title="Remove company" style={{ background: "none", border: "none", color: "#ccc", fontSize: 16, cursor: "pointer", padding: "2px 6px", borderRadius: 5, lineHeight: 1 }} onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#ccc")}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Company detail drawer */}
      {selectedCompany && (
        <CompanyDrawer
          company={selectedCompany}
          userTargetRoles={userTargetRoles}
          onClose={() => setSelectedId(null)}
          onPatch={patchField}
          onRefreshed={handleRefreshed}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}

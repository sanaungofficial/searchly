"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CompanyLogo } from "@/components/scout/company-logo";

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

function enrichmentWebsite(company: TrackedCompany): string | null {
  return (company.enrichmentCache as EnrichmentCache | null)?.websiteUrl ?? null;
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

function parseRolesText(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text.split(/[,;\n]+/).map((r) => r.trim()).filter(Boolean);
}

function buildMatchRoles(profileRoles: string[], companyTargetRoles: string | null): string[] {
  const seen = new Set<string>();
  return [...profileRoles, ...parseRolesText(companyTargetRoles)].filter((role) => {
    const key = role.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isJobMatch(jobTitle: string, matchRoles: string[]): boolean {
  if (!matchRoles.length) return false;
  const title = jobTitle.toLowerCase();
  return matchRoles.some((role) =>
    role.toLowerCase().split(/\s+/).filter((w) => w.length > 3).some((w) => title.includes(w))
  );
}

function hasScanSource(company: TrackedCompany): boolean {
  return !!(company.careersUrl?.trim() || company.website?.trim());
}

function humanizeApiError(message: string | undefined, status: number): string {
  if (status === 503 || message === "AI not configured") {
    return "AI scanning isn't available on staging — try on app.kimchi.so.";
  }
  if (message?.includes("Careers URL or website")) {
    return "Add a careers URL (or website) before scanning.";
  }
  if (message?.includes("JavaScript or login")) {
    return "This careers page needs a browser — try the direct ATS link (e.g. boards.greenhouse.io/company).";
  }
  if (message?.includes("block bots") || message?.includes("Could not fetch")) {
    return "Couldn't reach the careers page — paste the direct jobs listing URL.";
  }
  return message ?? "Something went wrong. Try again.";
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#991b1b", lineHeight: 1.45 }}>{message}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ background: "none", border: "none", color: "#991b1b", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
      )}
    </div>
  );
}

function ScanHint({ company }: { company: TrackedCompany }) {
  if (hasScanSource(company)) return null;
  return (
    <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#9ca3af", marginTop: 4, lineHeight: 1.4 }}>
      Add a careers URL to scan open roles.
    </div>
  );
}

interface CompanySuggestion {
  id: string | null;
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  type: string | null;
  source: "catalog" | "intel";
}

function formatSuggestionMeta(item: CompanySuggestion): string {
  if (item.type) return item.type;
  return "Dream company";
}

function CompanySuggestInput({
  value,
  onChange,
  onSelect,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (item: CompanySuggestion | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [picked, setPicked] = useState<CompanySuggestion | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
      setPicked(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/suggest?q=${encodeURIComponent(value.trim())}`);
        if (res.ok) {
          const data: CompanySuggestion[] = await res.json();
          setSuggestions(data);
          const keepClosed = picked && picked.name.toLowerCase() === value.trim().toLowerCase();
          setOpen(!keepClosed && data.length > 0);
        }
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(timer);
  }, [value, picked]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(item: CompanySuggestion) {
    setPicked(item);
    onChange(item.name);
    onSelect(item);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        autoFocus
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          onSelect(null);
          setPicked(null);
          setOpen(true);
        }}
        onFocus={() => !picked && suggestions.length > 0 && setOpen(true)}
        placeholder="Start typing — e.g. Oracle, Comcast, Stripe"
        style={{ width: "100%", border: picked ? "1px solid #1a3a2f" : "1px solid #e5e7eb", borderRadius: 7, padding: "7px 11px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "var(--font-ui)" }}
        required
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, maxHeight: 280, overflowY: "auto" }}>
          {suggestions.map((item) => (
            <button
              key={`${item.catalogSlug}-${item.id ?? "catalog"}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 12px", border: "none", borderBottom: "1px solid #f3f4f6", background: picked?.catalogSlug === item.catalogSlug ? "#f0f7f4" : "#fff", cursor: "pointer", fontFamily: "var(--font-ui)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#faf8f5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = picked?.catalogSlug === item.catalogSlug ? "#f0f7f4" : "#fff"; }}
            >
              <CompanyLogo name={item.name} website={item.website} careersUrl={item.careersUrl} size={24} borderRadius={6} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{item.name}</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{formatSuggestionMeta(item)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
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
      <textarea ref={ref} value={local} onChange={(e) => setLocal(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); onBlur(local); }} placeholder={placeholder} rows={1} style={{ width: "100%", fontFamily: "var(--font-ui)", fontSize: 14, color: "#1a1a1a", background: "transparent", border: "none", outline: "none", resize: "none", lineHeight: 1.55, padding: 0, overflow: "hidden" }} />
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
      <input value={local} onChange={(e) => setLocal(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); onBlur(local); }} placeholder={placeholder} style={{ width: "100%", fontFamily: mono ? "monospace" : "var(--font-ui)", fontSize: mono ? 11 : 12, fontWeight: bold ? 600 : 400, color: mono ? "#6b7280" : "#1a1a1a", background: "transparent", border: "none", outline: "none", padding: 0 }} />
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
      <button ref={btnRef} onClick={handleOpen} style={{ background: color.bg, color: color.text, border: "none", borderRadius: 5, padding: "3px 8px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{value || "—"}</button>
      {open && (
        <div style={{ position: "fixed", top: coords.top, left: coords.left, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 100, overflow: "hidden" }}>
          {["HIGH", "MEDIUM", "LOW", ""].map((opt) => (
            <button key={opt || "none"} onClick={() => { onChange(opt); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: value === opt ? "#f3f4f6" : "transparent", border: "none", cursor: "pointer", fontSize: 14, fontWeight: opt ? 600 : 400, color: opt === "HIGH" ? "#dc2626" : opt === "MEDIUM" ? "#d97706" : opt === "LOW" ? "#16a34a" : "#6b7280" }}>{opt || "None"}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function companySubtitle(company: TrackedCompany): string | null {
  return company.type?.trim() || company.hqLocation?.trim() || null;
}

function priorityRank(priority: string | null): number {
  if (priority === "HIGH") return 0;
  if (priority === "MEDIUM") return 1;
  if (priority === "LOW") return 2;
  return 3;
}

function sortCompanies(list: TrackedCompany[]): TrackedCompany[] {
  return [...list].sort((a, b) => {
    const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
    if (byPriority !== 0) return byPriority;
    return a.name.localeCompare(b.name);
  });
}

function OpenRolesSummary({
  company,
  userTargetRoles,
  scanning,
}: {
  company: TrackedCompany;
  userTargetRoles: string[];
  scanning?: boolean;
}) {
  const cache = company.jobsCache as JobsCache | null;
  const jobCount = cache?.jobs?.length ?? 0;
  const matchRoles = buildMatchRoles(userTargetRoles, company.targetRoles);
  const matchCount = cache?.jobs?.filter((j) => isJobMatch(j.title, matchRoles)).length ?? 0;

  if (scanning) {
    return <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#6b7280" }}>Scanning…</span>;
  }
  if (!hasScanSource(company)) {
    return <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#9ca3af" }}>Add careers URL</span>;
  }
  if (jobCount === 0) {
    return <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#9ca3af" }}>No roles yet</span>;
  }
  return (
    <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1a1a1a" }}>
      {jobCount} {jobCount === 1 ? "role" : "roles"}
      {matchCount > 0 && (
        <span style={{ color: "#16a34a", fontWeight: 600 }}> · {matchCount} match{matchCount !== 1 ? "es" : ""}</span>
      )}
    </span>
  );
}

function DrawerJobRow({ job, match }: { job: CachedJob; match: boolean }) {
  return (
    <div style={{ padding: "10px 14px", borderBottom: "1px solid #f0ebe4", display: "flex", alignItems: "flex-start", gap: 10, background: match ? "#f9fffe" : "#fff" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {job.url ? (
          <a href={job.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "#1a1a1a", textDecoration: "none", display: "block" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>{job.title}</a>
        ) : (
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>{job.title}</span>
        )}
        {(job.department || job.location) && (
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#6b7280", marginTop: 2 }}>
            {[job.department, job.location].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      {match && (
        <span style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 4, padding: "2px 7px", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0, marginTop: 2, fontFamily: "var(--font-ui)", letterSpacing: "0.03em" }}>Match</span>
      )}
    </div>
  );
}

// ── Company Detail Drawer ────────────────────────────────────────────────────

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "var(--scout-muted)", marginBottom: 3 }}>{label}</div>
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
  const cache = company.jobsCache as JobsCache | null;
  const jobs = cache?.jobs ?? [];
  const intel = company.enrichmentCache as EnrichmentCache | null;
  const matchRoles = buildMatchRoles(userTargetRoles, company.targetRoles);
  const canScan = hasScanSource(company);
  const matchingJobs = jobs.filter((j) => isJobMatch(j.title, matchRoles));
  const otherJobs = jobs.filter((j) => !isJobMatch(j.title, matchRoles));

  async function handleEnrich() {
    setEnriching(true); setEnrichError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/enrich`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setEnrichError(humanizeApiError(data.error, res.status)); } else { onRefreshed(data); }
    } catch { setEnrichError("Network error — couldn't enrich company."); } finally { setEnriching(false); }
  }

  async function handleScan() {
    if (!canScan) {
      setScanError("Add a careers URL (or website) in Details below before scanning.");
      return;
    }
    setScanning(true); setScanError(null);
    try {
      const res = await fetch(`/api/companies/${company.id}/refresh`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setScanError(humanizeApiError(data.error, res.status)); } else { onRefreshed(data); }
    } catch { setScanError("Network error — couldn't scan careers page."); } finally { setScanning(false); }
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
              <CompanyLogo
                name={company.name}
                website={company.website}
                careersUrl={company.careersUrl}
                enrichmentWebsiteUrl={enrichmentWebsite(company)}
                size={40}
                borderRadius={10}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <InlineInput value={company.name} placeholder="Company name" onBlur={(v) => v.trim() && onPatch(company.id, "name", v)} bold />
                <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  {company.website && <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "monospace", fontSize: 14, color: "#6b7280", textDecoration: "none" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>↗ Website</a>}
                  {company.careersUrl && <a href={company.careersUrl.startsWith("http") ? company.careersUrl : `https://${company.careersUrl}`} target="_blank" rel="noopener noreferrer" style={{ fontFamily: "monospace", fontSize: 14, color: "#6b7280", textDecoration: "none" }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}>↗ Careers</a>}
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
                <button onClick={handleEnrich} disabled={enriching} style={{ background: enriching ? "#f3f4f6" : "#1a1a1a", color: enriching ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 14, cursor: enriching ? "not-allowed" : "pointer", fontFamily: "var(--font-ui)", fontWeight: 500 }}>
                  {enriching ? "Researching…" : "✦ Enrich with AI"}
                </button>
                {enrichError && <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#dc2626", marginTop: 6 }}>{enrichError}</div>}
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginTop: 6 }}>Pulls company overview, funding, leadership, and recent news from AI.</div>
              </div>
            ) : (
              <div>
                {/* Description */}
                {intel.description && <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#374151", lineHeight: 1.6, margin: "0 0 14px 0" }}>{intel.description}</p>}

                {/* Quick stats row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {intel.founded && <span style={{ background: "#f3f4f6", borderRadius: 5, padding: "3px 8px", fontSize: 14, color: "#374151", fontFamily: "var(--font-ui)" }}>📅 Founded {intel.founded}</span>}
                  {intel.headquarters && <span style={{ background: "#f3f4f6", borderRadius: 5, padding: "3px 8px", fontSize: 14, color: "#374151", fontFamily: "var(--font-ui)" }}>📍 {intel.headquarters}</span>}
                  {intel.employeeCount && <span style={{ background: "#f3f4f6", borderRadius: 5, padding: "3px 8px", fontSize: 14, color: "#374151", fontFamily: "var(--font-ui)" }}>👥 {intel.employeeCount}</span>}
                  {intel.industry && <span style={{ background: "#f3f4f6", borderRadius: 5, padding: "3px 8px", fontSize: 14, color: "#374151", fontFamily: "var(--font-ui)" }}>{intel.industry}</span>}
                  {intel.glassdoorRating && <span style={{ background: "#f0fdf4", borderRadius: 5, padding: "3px 8px", fontSize: 14, color: "#16a34a", fontFamily: "var(--font-ui)", fontWeight: 600 }}>★ {intel.glassdoorRating} Glassdoor</span>}
                </div>

                {/* Funding */}
                {(intel.fundingStage || intel.totalFunding || (intel.keyInvestors?.length > 0)) && (
                  <div style={{ background: "#faf8f5", border: "1px solid #e8e3dd", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Funding</div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {intel.fundingStage && <div><div style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)" }}>Stage</div><div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-ui)" }}>{intel.fundingStage}</div></div>}
                      {intel.totalFunding && <div><div style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)" }}>Total</div><div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-ui)" }}>{intel.totalFunding}</div></div>}
                      {intel.keyInvestors?.length > 0 && <div><div style={{ fontSize: 14, color: "var(--scout-muted)", fontFamily: "var(--font-ui)" }}>Investors</div><div style={{ fontSize: 14, color: "#374151", fontFamily: "var(--font-ui)" }}>{intel.keyInvestors.join(", ")}</div></div>}
                    </div>
                  </div>
                )}

                {/* Leadership */}
                {intel.leadership?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Leadership</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {intel.leadership.map((l, i) => (
                        <div key={i} style={{ background: "#fff", border: "1px solid #e8e3dd", borderRadius: 7, padding: "7px 12px", minWidth: 120 }}>
                          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{l.name}</div>
                          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#6b7280" }}>{l.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent News */}
                {intel.recentNews?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Recent News</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {intel.recentNews.map((n, i) => (
                        <div key={i} style={{ background: "#faf8f5", border: "1px solid #e8e3dd", borderRadius: 7, padding: "8px 12px" }}>
                          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>{n.title}</div>
                          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#6b7280", marginTop: 2 }}>{n.summary} <span style={{ color: "var(--scout-muted)" }}>· {n.date}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Re-enrich */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={handleEnrich} disabled={enriching} style={{ fontSize: 14, color: "#6b7280", background: "none", border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 10px", cursor: enriching ? "not-allowed" : "pointer", fontFamily: "var(--font-ui)" }}>
                    {enriching ? "Refreshing…" : "↻ Refresh intel"}
                  </button>
                  {company.enrichmentFetchedAt && <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Updated {timeAgo(company.enrichmentFetchedAt)}</span>}
                </div>
                {enrichError && <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#dc2626", marginTop: 6 }}>{enrichError}</div>}
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#d1d5db", marginTop: 6 }}>AI-generated · may not reflect latest data</div>
              </div>
            )}
          </DrawerSection>

          {/* Open Roles */}
          <DrawerSection title="Open Roles">
            {!canScan && (
              <div style={{ background: "#faf8f5", border: "1px solid #e8e3dd", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontFamily: "var(--font-ui)", fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
                Paste the direct careers or jobs listing URL in Details below. Homepage links often fail — ATS pages (Greenhouse, Lever, Workday) work best.
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <button onClick={handleScan} disabled={scanning || !canScan} style={{ background: scanning || !canScan ? "#f3f4f6" : "#1a1a1a", color: scanning || !canScan ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 14, cursor: scanning || !canScan ? "not-allowed" : "pointer", fontFamily: "var(--font-ui)", fontWeight: 500 }}>
                {scanning ? "Scanning…" : jobs.length > 0 ? "↻ Re-scan" : "Scan for roles"}
              </button>
              {company.lastJobsFetchedAt && <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>Last scanned {timeAgo(company.lastJobsFetchedAt)}</span>}
            </div>
            {scanError && <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#dc2626", marginBottom: 8, lineHeight: 1.4 }}>{scanError}</div>}

            {jobs.length === 0 && !scanning ? (
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", padding: "16px 0", lineHeight: 1.5 }}>
                {canScan
                  ? "Scanning runs automatically when you add a company. Roles appear here once the shared cache is ready — or click Re-scan."
                  : "Add a careers URL in Details — roles scan automatically once a URL is set."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {matchingJobs.length > 0 && (
                  <div>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "#16a34a", marginBottom: 8 }}>
                      Matches for you ({matchingJobs.length})
                    </div>
                    <div style={{ border: "1px solid #e8e3dd", borderRadius: 8, overflow: "hidden" }}>
                      {matchingJobs.map((job, i) => (
                        <DrawerJobRow key={`m-${i}-${job.title}`} job={job} match />
                      ))}
                    </div>
                  </div>
                )}
                {otherJobs.length > 0 && (
                  <div>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--scout-muted)", marginBottom: 8 }}>
                      All open roles ({otherJobs.length})
                    </div>
                    <div style={{ border: "1px solid #e8e3dd", borderRadius: 8, overflow: "hidden", maxHeight: 360, overflowY: "auto" }}>
                      {otherJobs.map((job, i) => (
                        <DrawerJobRow key={`o-${i}-${job.title}`} job={job} match={false} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {jobs.length > 0 && matchRoles.length > 0 && (
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginTop: 8, lineHeight: 1.45 }}>
                Matching against: {matchRoles.slice(0, 4).join(", ")}{matchRoles.length > 4 ? ` +${matchRoles.length - 4} more` : ""}
                {parseRolesText(company.targetRoles).length > 0 && userTargetRoles.length > 0 && (
                  <span> (profile roles + roles at this company)</span>
                )}
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
            <button onClick={() => { onRemove(company.id); onClose(); }} style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#dc2626", background: "none", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }} onMouseEnter={(e) => { (e.currentTarget.style.background = "#fef2f2"); }} onMouseLeave={(e) => { (e.currentTarget.style.background = "none"); }}>
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<CompanySuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userTargetRoles, setUserTargetRoles] = useState<string[]>([]);
  const [pendingScanIds, setPendingScanIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/companies");
      if (res.ok) {
        setCompanies(await res.json());
      } else if (res.status === 401) {
        setLoadError("Sign in to view your dream companies watchlist.");
      } else {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.error ?? "Couldn't load companies. Refresh to try again.");
      }
    } catch {
      setLoadError("Network error — couldn't load companies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (pendingScanIds.length === 0) return;
    const interval = setInterval(() => { load(); }, 4000);
    const timeout = setTimeout(() => setPendingScanIds([]), 60000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [pendingScanIds, load]);

  useEffect(() => {
    if (pendingScanIds.length === 0) return;
    setPendingScanIds((ids) =>
      ids.filter((id) => {
        const row = companies.find((c) => c.id === id);
        return row && !(row.jobsCache as JobsCache | null)?.jobs?.length && !row.lastJobsFetchedAt;
      })
    );
  }, [companies, pendingScanIds.length]);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => {
      if (Array.isArray(d.targetRoles)) setUserTargetRoles(d.targetRoles);
    }).catch(() => {});
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); if (!newName.trim()) return;
    setSaving(true); setAddError(null);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedSuggestion?.name ?? newName.trim(),
          catalogSlug: selectedSuggestion?.catalogSlug,
          companyIntelId: selectedSuggestion?.id ?? undefined,
          website: selectedSuggestion?.website ?? undefined,
          careersUrl: selectedSuggestion?.careersUrl ?? undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json() as TrackedCompany & { scanPending?: boolean };
        const { scanPending, ...companyRow } = created;
        setCompanies((prev) => [companyRow, ...prev]);
        if (scanPending) setPendingScanIds((ids) => [...ids, companyRow.id]);
        setNewName("");
        setSelectedSuggestion(null);
        setShowAdd(false);
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setAddError("Already on your watchlist.");
        } else {
          setAddError(data.error ?? "Couldn't add company. Try again.");
        }
      }
    } catch {
      setAddError("Network error — company not added.");
    } finally {
      setSaving(false);
    }
  }

  async function patchField(id: string, field: Field, value: string) {
    const trimmed = value.trim();
    const existing = companies.find((c) => c.id === id);
    if (!existing) return;
    const previousValue = existing[field];

    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: trimmed || null } : c)));
    setSaveError(null);

    try {
      const res = await fetch(`/api/companies/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: trimmed || null }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: previousValue } : c)));
        setSaveError(data.error ?? "Couldn't save — changes reverted.");
      }
    } catch {
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: previousValue } : c)));
      setSaveError("Network error — changes not saved.");
    }
  }

  async function handleRemove(id: string) {
    setRemoveError(null);
    try {
      const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCompanies((prev) => prev.filter((c) => c.id !== id));
        if (selectedId === id) setSelectedId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setRemoveError(data.error ?? "Couldn't remove company.");
      }
    } catch {
      setRemoveError("Network error — company may still be on your watchlist.");
    }
  }

  function handleRefreshed(updated: TrackedCompany) {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  const selectedCompany = companies.find((c) => c.id === selectedId) ?? null;

  const thStyle: React.CSSProperties = { fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.08em", padding: "10px 14px", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #e8e3dd", background: "#faf8f5" };
  const tdStyle: React.CSSProperties = { padding: "12px 14px", verticalAlign: "top", borderBottom: "1px solid #f0ebe4" };

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 16, color: "#1a1a1a" }}>Tracked Companies</div>
          <div style={{ fontFamily: "var(--font-ui)", color: "var(--scout-muted)", fontSize: 14, marginTop: 2 }}>{companies.length} {companies.length === 1 ? "company" : "companies"} on your watchlist</div>
        </div>
        <button onClick={() => { setShowAdd((s) => !s); setAddError(null); setSelectedSuggestion(null); if (showAdd) setNewName(""); }} style={{ background: showAdd ? "#f3f4f6" : "#1a1a1a", color: showAdd ? "#1a1a1a" : "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-ui)" }}>
          {showAdd ? "Cancel" : "+ Track company"}
        </button>
      </div>

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}
      {saveError && <ErrorBanner message={saveError} onDismiss={() => setSaveError(null)} />}
      {removeError && <ErrorBanner message={removeError} onDismiss={() => setRemoveError(null)} />}

      {showAdd && (
        <form onSubmit={handleAdd} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "#555", display: "block", marginBottom: 5 }}>Company name *</label>
              <CompanySuggestInput
                value={newName}
                onChange={setNewName}
                onSelect={setSelectedSuggestion}
                disabled={saving}
              />
            </div>
            <button type="submit" disabled={saving || !newName.trim()} style={{ background: "#1a1a1a", color: "#fff", border: "none", borderRadius: 7, padding: "7px 18px", fontSize: 14, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", opacity: saving || !newName.trim() ? 0.5 : 1, fontFamily: "var(--font-ui)" }}>{saving ? "Adding…" : "Add"}</button>
          </div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", marginTop: 10, lineHeight: 1.45 }}>
            {selectedSuggestion
              ? `${selectedSuggestion.name} selected — press Add to track${selectedSuggestion.careersUrl ? " and scan open roles" : ""}.`
              : "Pick from the list or type any company name, then press Add."}
          </div>
          {addError && <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#dc2626", marginTop: 8 }}>{addError}</div>}
        </form>
      )}

      {loading ? (
        <div style={{ color: "var(--scout-muted)", fontSize: 14, padding: "48px 0", textAlign: "center", fontFamily: "var(--font-ui)" }}>Loading…</div>
      ) : loadError && companies.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed #d1d5db", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-ui)", color: "var(--scout-muted)", fontSize: 14 }}>Couldn&apos;t load your watchlist.</div>
          <button type="button" onClick={() => { setLoading(true); load(); }} style={{ marginTop: 12, fontFamily: "var(--font-ui)", fontSize: 14, color: "#1a1a1a", background: "#f3f4f6", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer" }}>Retry</button>
        </div>
      ) : companies.length === 0 ? (
        <div style={{ background: "#fff", border: "1.5px dashed #d1d5db", borderRadius: 12, padding: "48px 32px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <div style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 14, color: "#1a1a1a", marginBottom: 6 }}>No dream companies yet</div>
          <div style={{ fontFamily: "var(--font-ui)", color: "var(--scout-muted)", fontSize: 14, lineHeight: 1.5 }}>Track employers you&apos;re watching — add a careers URL to scan open roles without checking every page manually.</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid #e8e3dd" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={{ ...thStyle, width: 100 }}>Priority</th>
                <th style={{ ...thStyle, width: 160 }}>Open roles</th>
                <th style={{ ...thStyle, width: 130 }}>Last scanned</th>
                <th style={{ ...thStyle, width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const sorted = sortCompanies(companies);
                return sorted.map((c, i) => {
                const isLast = i === sorted.length - 1;
                const rowTd: React.CSSProperties = { ...tdStyle, borderBottom: isLast ? "none" : tdStyle.borderBottom };
                const scanning = pendingScanIds.includes(c.id);
                const subtitle = companySubtitle(c);
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    style={{ background: selectedId === c.id ? "#faf8f5" : "#fff", cursor: "pointer" }}
                  >
                    <td style={rowTd}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <CompanyLogo
                          name={c.name}
                          website={c.website}
                          careersUrl={c.careersUrl}
                          enrichmentWebsiteUrl={enrichmentWebsite(c)}
                          size={32}
                          borderRadius={7}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{c.name}</div>
                          {subtitle && (
                            <div style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--scout-muted)", marginTop: 2 }}>{subtitle}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={rowTd} onClick={(e) => e.stopPropagation()}>
                      <PriorityBadge value={c.priority ?? ""} onChange={(v) => patchField(c.id, "priority", v)} />
                    </td>
                    <td style={rowTd}>
                      <OpenRolesSummary company={c} userTargetRoles={userTargetRoles} scanning={scanning} />
                    </td>
                    <td style={rowTd}>
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: c.lastJobsFetchedAt ? "#1a1a1a" : "#9ca3af" }}>
                        {scanning ? "Scanning…" : c.lastJobsFetchedAt ? timeAgo(c.lastJobsFetchedAt) : "—"}
                      </span>
                    </td>
                    <td style={{ ...rowTd, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleRemove(c.id)} title="Remove company" style={{ background: "none", border: "none", color: "#ccc", fontSize: 16, cursor: "pointer", padding: "2px 6px", borderRadius: 5, lineHeight: 1 }} onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")} onMouseLeave={(e) => (e.currentTarget.style.color = "#ccc")}>×</button>
                    </td>
                  </tr>
                );
              });
              })()}
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

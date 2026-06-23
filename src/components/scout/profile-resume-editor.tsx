"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Pencil,
  Download,
  Loader2,
  Check,
  Printer,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { fontSans } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type ParsedResumeData,
  type ParsedWorkEntry,
  type ParsedEducationEntry,
  type ParsedSkillGroup,
  type ParsedCertificationEntry,
  emptyParsedResumeData,
  resumeCompleteness,
  hasParsedResumeSections,
} from "@/lib/resume-parse";

type SectionKey = "header" | "summary" | "skills" | "experience" | "education" | "certifications";

interface ProfileResumeEditorProps {
  open: boolean;
  assetId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

interface AssetResponse {
  id: string;
  name: string;
  isPrimary: boolean;
  parsedData: ParsedResumeData | null;
  profileName?: string | null;
  profileEmail?: string | null;
}

interface AnalysisData {
  score?: number;
  headline?: string;
  strengths?: string[];
  improvements?: { priority: string; title: string; detail: string }[];
  error?: string;
}

function formatDateRange(from?: string | null, to?: string | null) {
  if (!from && !to) return null;
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return m ? `${months[parseInt(m, 10) - 1]} ${y}` : y;
  };
  const start = from ? fmt(from) : "";
  const end = to === "Present" ? "Present" : to ? fmt(to) : "Present";
  return `${start}${start && end ? " – " : ""}${end}`;
}

function CompletenessRing({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={44} cy={44} r={r} fill="none" stroke="#F0EDE8" strokeWidth={6} />
        <circle
          cx={44}
          cy={44}
          r={r}
          fill="none"
          stroke={pct >= 70 ? "#2E7D52" : pct >= 40 ? "#D4A017" : "#C0392B"}
          strokeWidth={6}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x={44} y={48} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1A1A1A">
          {pct}%
        </text>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#52493F", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Profile completeness
      </span>
    </div>
  );
}

const btnGhost: React.CSSProperties = {
  padding: "6px 14px",
  background: "#FFFFFF",
  color: "#52493F",
  border: "1px solid #D8D0C5",
  borderRadius: 5,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "var(--font-ui), sans-serif",
};

const btnPrimary: React.CSSProperties = {
  ...btnGhost,
  background: "#1C3A2F",
  color: "#E8D5A3",
  border: "none",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "#1A1A1A",
  marginBottom: 6,
  borderBottom: "1px solid #1A1A1A",
  paddingBottom: 3,
};

export function ProfileResumeEditor({ open, assetId, onClose, onUpdated }: ProfileResumeEditorProps) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [reparsing, setReparsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedResumeData>(emptyParsedResumeData());
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [draft, setDraft] = useState<ParsedResumeData>(emptyParsedResumeData());
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(true);

  const completeness = resumeCompleteness(parsedData);

  const loadAnalysis = useCallback(async (id: string, force = false) => {
    setAnalysisLoading(true);
    try {
      const url = force ? `/api/assets/${id}/analysis?force=true` : `/api/assets/${id}/analysis`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setAnalysis(data);
      else setAnalysis({ error: data.error || "Analysis unavailable" });
    } catch {
      setAnalysis({ error: "Could not load analysis" });
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  const loadAsset = useCallback(async (id: string) => {
    setLoading(true);
    setEditingSection(null);
    try {
      const res = await fetch(`/api/assets/${id}`);
      if (!res.ok) return;
      const data: AssetResponse = await res.json();
      setAssetName(data.name || "Resume");
      setIsPrimary(!!data.isPrimary);

      let pd = data.parsedData ?? emptyParsedResumeData();
      if (!pd.name && data.profileName) pd = { ...pd, name: data.profileName };
      if (!pd.email && data.profileEmail) pd = { ...pd, email: data.profileEmail };

      if (!hasParsedResumeSections(pd)) {
        setReparsing(true);
        try {
          const reparseRes = await fetch(`/api/assets/${id}/reparse`, { method: "POST" });
          if (reparseRes.ok) {
            const reparseData = await reparseRes.json();
            if (reparseData.parsedData) pd = reparseData.parsedData;
          }
        } finally {
          setReparsing(false);
        }
      }

      setParsedData(pd);
      loadAnalysis(id);
    } finally {
      setLoading(false);
    }
  }, [loadAnalysis]);

  useEffect(() => {
    if (open && assetId) loadAsset(assetId);
    if (!open) {
      setEditingSection(null);
      setAnalysis(null);
    }
  }, [open, assetId, loadAsset]);

  if (!open) return null;

  async function saveParsedData(updated: ParsedResumeData) {
    if (!assetId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsedData: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        const saved = data.asset?.parsedData ?? updated;
        setParsedData(saved);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        onUpdated?.();
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(section: SectionKey) {
    setEditingSection(section);
    setDraft(JSON.parse(JSON.stringify(parsedData)) as ParsedResumeData);
  }

  function cancelEdit() {
    setEditingSection(null);
  }

  function saveEdit() {
    if (!editingSection) return;
    void saveParsedData(draft);
    setEditingSection(null);
  }

  async function downloadDocx() {
    if (!assetId) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/assets/${assetId}/download?format=docx`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${assetName || "resume"}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  }

  function printResume() {
    window.print();
  }

  function updateWorkEntry(id: string, patch: Partial<ParsedWorkEntry>) {
    setDraft((d) => ({
      ...d,
      workExperience: d.workExperience.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  }

  function updateEducationEntry(id: string, patch: Partial<ParsedEducationEntry>) {
    setDraft((d) => ({
      ...d,
      education: d.education.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  function updateSkillGroup(id: string, patch: Partial<ParsedSkillGroup>) {
    setDraft((d) => ({
      ...d,
      skillGroups: d.skillGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  }

  function updateCertEntry(id: string, patch: Partial<ParsedCertificationEntry>) {
    setDraft((d) => ({
      ...d,
      certifications: d.certifications.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  const data = editingSection ? draft : parsedData;
  const skillGroups = data.skillGroups.length
    ? data.skillGroups
    : data.skills.length
      ? [{ id: "skills_0", label: "Skills", skills: data.skills }]
      : [];

  function SectionHeader({ title, section }: { title: string; section: SectionKey }) {
    const isEditing = editingSection === section;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ ...sectionTitleStyle, margin: 0, flex: 1 }}>{title}</p>
        <div style={{ display: "flex", gap: 4 }}>
          {isEditing ? (
            <>
              <button onClick={cancelEdit} style={{ ...btnGhost, padding: "4px 10px", fontSize: 13 }}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{ ...btnPrimary, padding: "4px 10px", fontSize: 13 }}>
                {saving ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={12} />}
                Save
              </button>
            </>
          ) : (
            <button
              onClick={() => startEdit(section)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#6B6258", display: "flex" }}
              aria-label={`Edit ${title}`}
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid #D8D0C5",
    borderRadius: 4,
    fontSize: 13,
    fontFamily: fontSans,
    color: "#1A1A1A",
    background: "#FAFAF8",
    boxSizing: "border-box",
    outline: "none",
  };

  const sidebar = (
    <div
      className="resume-print-hide"
      style={{
        width: isMobile ? "100%" : 260,
        borderRight: isMobile ? "none" : "1px solid #E5DDD0",
        borderBottom: isMobile ? "1px solid #E5DDD0" : "none",
        padding: isMobile ? "20px 16px" : "28px 24px",
        overflowY: "auto",
        flexShrink: 0,
        background: "#FDFAF5",
      }}
    >
      <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <CompletenessRing pct={completeness.pct} />
        {completeness.missing.length > 0 && (
          <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", width: "100%" }}>
            {completeness.missing.slice(0, 4).map((m) => (
              <li key={m} style={{ fontSize: 13, color: "#7A6E64", marginBottom: 4, paddingLeft: 12, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: "#C0392B" }}>•</span>
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <button
          onClick={() => setAnalysisOpen(!analysisOpen)}
          style={{
            width: "100%",
            padding: "10px 14px",
            background: analysisOpen ? "#F5F3EF" : "#1C3A2F",
            color: analysisOpen ? "#52493F" : "#E8D5A3",
            border: analysisOpen ? "1px solid #D8D0C5" : "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            marginBottom: analysisOpen ? 10 : 0,
          }}
        >
          <Sparkles size={13} />
          {analysisOpen ? "Hide AI Analysis" : "Show AI Analysis"}
        </button>

        {analysisOpen && (
          <div style={{ padding: "14px 16px", background: "#FFFFFF", border: "1px solid #E5DDD0", borderRadius: 7 }}>
            {analysisLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: "#6B6258" }} />
                <span style={{ fontSize: 14, color: "#7A6E64" }}>Analyzing resume…</span>
              </div>
            ) : analysis?.error ? (
              <p style={{ fontSize: 14, color: "#7A6E64", margin: 0 }}>{analysis.error}</p>
            ) : analysis ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#52493F", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Quality Score
                  </span>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: (analysis.score ?? 0) >= 70 ? "#2E7D52" : (analysis.score ?? 0) >= 40 ? "#B8860B" : "#C0392B",
                  }}>
                    {analysis.score ?? "—"}%
                  </span>
                </div>
                {analysis.headline && (
                  <p style={{ fontSize: 14, color: "#1A1A1A", margin: "0 0 12px", lineHeight: 1.5 }}>{analysis.headline}</p>
                )}
                {(analysis.strengths || []).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--scout-muted)", margin: "0 0 5px", textTransform: "uppercase" }}>Strengths</p>
                    {(analysis.strengths || []).map((s) => (
                      <p key={s} style={{ fontSize: 13, color: "#2E7D52", margin: "0 0 4px" }}>✓ {s}</p>
                    ))}
                  </div>
                )}
                {(analysis.improvements || []).slice(0, 3).map((imp, i) => (
                  <div key={i} style={{ marginBottom: 8, padding: "8px 10px", background: "#FFF8F0", borderRadius: 5 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#52493F", margin: "0 0 3px" }}>{imp.title}</p>
                    <p style={{ fontSize: 13, color: "#7A6E64", margin: 0, lineHeight: 1.4 }}>{imp.detail}</p>
                  </div>
                ))}
                <button
                  onClick={() => assetId && loadAnalysis(assetId, true)}
                  style={{ ...btnGhost, width: "100%", justifyContent: "center", marginTop: 8, fontSize: 13 }}
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="resume-print-outer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 24,
        fontFamily: "var(--font-ui), sans-serif",
      }}
    >
      <div
        className="resume-print-backdrop"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}
      />
      <div
        className="resume-print-target"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: isMobile ? "100%" : 1200,
          height: isMobile ? "100%" : "90vh",
          background: "#F7F5F2",
          borderRadius: isMobile ? 0 : 14,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: isMobile ? "none" : "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Top bar */}
        <div
          className="resume-print-hide"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "0 12px" : "0 28px",
            height: 56,
            borderBottom: "1px solid #E5DDD0",
            background: "#FDFAF5",
            flexShrink: 0,
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 5, color: "#52493F", flexShrink: 0 }}
            >
              <X size={16} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {assetName}
            </span>
            {isPrimary && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", background: "#E8D5A3", color: "#1C3A2F", borderRadius: 10, flexShrink: 0 }}>
                Primary
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {saved && (
              <span style={{ fontSize: 14, color: "#4A8B6A", display: "flex", alignItems: "center", gap: 4 }}>
                <Check size={13} /> Saved
              </span>
            )}
            <button onClick={printResume} style={btnGhost}>
              <Printer size={14} /> {isMobile ? "Print" : "Preview / Print"}
            </button>
            <button onClick={downloadDocx} disabled={downloading} style={btnPrimary}>
              {downloading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
              Export DOCX
            </button>
            <button
              onClick={() => { setAnalysisOpen(true); assetId && loadAnalysis(assetId, true); }}
              style={{ ...btnGhost, background: "#F5F3EF" }}
            >
              <Sparkles size={14} /> AI Analysis
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>
          {sidebar}

          {/* Resume document */}
          <div
            className="resume-print-center"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: isMobile ? "20px 12px" : "32px 40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {loading || reparsing ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 80 }}>
                <Loader2 size={28} style={{ color: "var(--scout-muted)", animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: 14, color: "#6B6258" }}>
                  {reparsing ? "Parsing resume structure…" : "Loading resume…"}
                </p>
              </div>
            ) : (
              <div
                style={{
                  background: "#FFFFFF",
                  width: "100%",
                  maxWidth: 720,
                  padding: isMobile ? "32px 24px" : "52px 60px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.10)",
                  borderRadius: 4,
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: "#1A1A1A",
                }}
              >
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 20, borderBottom: "1.5px solid #1A1A1A" }}>
                  <SectionHeader title="Header" section="header" />
                  {editingSection === "header" ? (
                    <div style={{ textAlign: "left", display: "grid", gap: 8 }}>
                      <input style={inputStyle} value={draft.name || ""} placeholder="Full name" onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                        <input style={inputStyle} value={draft.email || ""} placeholder="Email" onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
                        <input style={inputStyle} value={draft.phone || ""} placeholder="Phone" onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
                        <input style={inputStyle} value={draft.location || ""} placeholder="Location" onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
                        <input style={inputStyle} value={draft.linkedinUrl || ""} placeholder="LinkedIn URL" onChange={(e) => setDraft((d) => ({ ...d, linkedinUrl: e.target.value }))} />
                        <input style={inputStyle} value={draft.website || ""} placeholder="Website" onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} />
                      </div>
                    </div>
                  ) : (
                    <>
                      {data.name && (
                        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 2, color: "#1A1A1A" }}>{data.name}</p>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "4px 24px", marginTop: 10, fontSize: 10 }}>
                        {data.email && <span>{data.email}</span>}
                        {data.phone && <span>{data.phone}</span>}
                        {data.location && <span>{data.location}</span>}
                        {data.linkedinUrl && <span>{data.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}</span>}
                        {data.website && <span>{data.website.replace(/^https?:\/\/(www\.)?/, "")}</span>}
                      </div>
                    </>
                  )}
                </div>

                {/* Summary */}
                {(data.summary || editingSection === "summary") && (
                  <div style={{ marginBottom: 18 }}>
                    <SectionHeader title="Professional Summary" section="summary" />
                    {editingSection === "summary" ? (
                      <textarea
                        rows={5}
                        style={{ ...inputStyle, resize: "vertical" }}
                        value={draft.summary || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                      />
                    ) : (
                      <p style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>{data.summary}</p>
                    )}
                  </div>
                )}

                {/* Skill groups */}
                {(skillGroups.length > 0 || editingSection === "skills") && (
                  <div style={{ marginBottom: 18 }}>
                    <SectionHeader title="Areas of Emphasis" section="skills" />
                    {editingSection === "skills" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {draft.skillGroups.map((g) => (
                          <div key={g.id} style={{ border: "1px solid #E5DDD0", borderRadius: 5, padding: 10 }}>
                            <input style={inputStyle} value={g.label} placeholder="Group label" onChange={(e) => updateSkillGroup(g.id, { label: e.target.value })} />
                            <input
                              style={{ ...inputStyle, marginTop: 6 }}
                              value={g.skills.join(", ")}
                              placeholder="Skills (comma-separated)"
                              onChange={(e) => updateSkillGroup(g.id, { skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => setDraft((d) => ({ ...d, skillGroups: [...d.skillGroups, { id: `sg_${Date.now()}`, label: "Skills", skills: [] }] }))}
                          style={{ ...btnGhost, justifyContent: "center", fontSize: 13 }}
                        >
                          <Plus size={12} /> Add group
                        </button>
                      </div>
                    ) : (
                      skillGroups.map((g) => (
                        <div key={g.id} style={{ marginBottom: 8 }}>
                          <p style={{ margin: "0 0 3px", fontWeight: 600, fontSize: 11 }}>{g.label}</p>
                          <p style={{ margin: 0, fontSize: 11 }}>{g.skills.join(" · ")}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Experience */}
                {(data.workExperience.length > 0 || editingSection === "experience") && (
                  <div style={{ marginBottom: 18 }}>
                    <SectionHeader title="Experience" section="experience" />
                    {editingSection === "experience" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {draft.workExperience.map((w) => (
                          <div key={w.id} style={{ border: "1px solid #E5DDD0", borderRadius: 5, padding: 10 }}>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6, marginBottom: 6 }}>
                              <input style={inputStyle} value={w.title} placeholder="Title" onChange={(e) => updateWorkEntry(w.id, { title: e.target.value })} />
                              <input style={inputStyle} value={w.company} placeholder="Company" onChange={(e) => updateWorkEntry(w.id, { company: e.target.value })} />
                              <input style={inputStyle} value={w.from || ""} placeholder="From (YYYY-MM)" onChange={(e) => updateWorkEntry(w.id, { from: e.target.value })} />
                              <input style={inputStyle} value={w.to || ""} placeholder="To (YYYY-MM or Present)" onChange={(e) => updateWorkEntry(w.id, { to: e.target.value })} />
                            </div>
                            <textarea
                              rows={4}
                              style={{ ...inputStyle, resize: "vertical" }}
                              value={w.bullets.join("\n")}
                              placeholder="One bullet per line"
                              onChange={(e) => updateWorkEntry(w.id, { bullets: e.target.value.split("\n").filter(Boolean) })}
                            />
                            <button
                              onClick={() => setDraft((d) => ({ ...d, workExperience: d.workExperience.filter((x) => x.id !== w.id) }))}
                              style={{ ...btnGhost, marginTop: 6, fontSize: 12, color: "#C0392B", border: "none", padding: "4px 0" }}
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              workExperience: [
                                ...d.workExperience,
                                { id: `exp_${Date.now()}`, company: "", title: "", bullets: [] },
                              ],
                            }))
                          }
                          style={{ ...btnGhost, justifyContent: "center", fontSize: 13 }}
                        >
                          <Plus size={12} /> Add experience
                        </button>
                      </div>
                    ) : (
                      data.workExperience.map((w) => (
                        <div key={w.id} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 11 }}>{w.title}</p>
                            {formatDateRange(w.from, w.to) && (
                              <span style={{ fontSize: 10, color: "#6B6258", flexShrink: 0 }}>{formatDateRange(w.from, w.to)}</span>
                            )}
                          </div>
                          <p style={{ margin: "2px 0 4px", fontStyle: "italic", fontSize: 11 }}>{w.company}</p>
                          {w.bullets.length > 0 && (
                            <ul style={{ margin: 0, paddingLeft: 16 }}>
                              {w.bullets.map((b, i) => (
                                <li key={i} style={{ marginBottom: 3, fontSize: 11 }}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Education */}
                {(data.education.length > 0 || editingSection === "education") && (
                  <div style={{ marginBottom: 18 }}>
                    <SectionHeader title="Education" section="education" />
                    {editingSection === "education" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {draft.education.map((e) => (
                          <div key={e.id} style={{ border: "1px solid #E5DDD0", borderRadius: 5, padding: 10 }}>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6 }}>
                              <input style={inputStyle} value={e.school} placeholder="School" onChange={(ev) => updateEducationEntry(e.id, { school: ev.target.value })} />
                              <input style={inputStyle} value={e.degree} placeholder="Degree" onChange={(ev) => updateEducationEntry(e.id, { degree: ev.target.value })} />
                              <input style={inputStyle} value={e.field || ""} placeholder="Field" onChange={(ev) => updateEducationEntry(e.id, { field: ev.target.value })} />
                              <input style={inputStyle} value={e.from || ""} placeholder="From" onChange={(ev) => updateEducationEntry(e.id, { from: ev.target.value })} />
                              <input style={inputStyle} value={e.to || ""} placeholder="To" onChange={(ev) => updateEducationEntry(e.id, { to: ev.target.value })} />
                            </div>
                            <button
                              onClick={() => setDraft((d) => ({ ...d, education: d.education.filter((x) => x.id !== e.id) }))}
                              style={{ ...btnGhost, marginTop: 6, fontSize: 12, color: "#C0392B", border: "none", padding: "4px 0" }}
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              education: [...d.education, { id: `edu_${Date.now()}`, school: "", degree: "" }],
                            }))
                          }
                          style={{ ...btnGhost, justifyContent: "center", fontSize: 13 }}
                        >
                          <Plus size={12} /> Add education
                        </button>
                      </div>
                    ) : (
                      data.education.map((e) => (
                        <div key={e.id} style={{ marginBottom: 8 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 11 }}>
                            {e.degree}{e.field ? `, ${e.field}` : ""}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: 11 }}>
                            {e.school}
                            {formatDateRange(e.from, e.to) ? ` · ${formatDateRange(e.from, e.to)}` : ""}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Certifications */}
                {(data.certifications.length > 0 || editingSection === "certifications") && (
                  <div style={{ marginBottom: 18 }}>
                    <SectionHeader title="Certifications" section="certifications" />
                    {editingSection === "certifications" ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {draft.certifications.map((c) => (
                          <div key={c.id} style={{ border: "1px solid #E5DDD0", borderRadius: 5, padding: 10 }}>
                            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6 }}>
                              <input style={inputStyle} value={c.name} placeholder="Certification name" onChange={(ev) => updateCertEntry(c.id, { name: ev.target.value })} />
                              <input style={inputStyle} value={c.issuer || ""} placeholder="Issuer" onChange={(ev) => updateCertEntry(c.id, { issuer: ev.target.value })} />
                              <input style={inputStyle} value={c.date || ""} placeholder="Date" onChange={(ev) => updateCertEntry(c.id, { date: ev.target.value })} />
                            </div>
                            <button
                              onClick={() => setDraft((d) => ({ ...d, certifications: d.certifications.filter((x) => x.id !== c.id) }))}
                              style={{ ...btnGhost, marginTop: 6, fontSize: 12, color: "#C0392B", border: "none", padding: "4px 0" }}
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              certifications: [...d.certifications, { id: `cert_${Date.now()}`, name: "" }],
                            }))
                          }
                          style={{ ...btnGhost, justifyContent: "center", fontSize: 13 }}
                        >
                          <Plus size={12} /> Add certification
                        </button>
                      </div>
                    ) : (
                      data.certifications.map((c) => (
                        <p key={c.id} style={{ margin: "0 0 4px", fontSize: 11 }}>
                          {c.name}
                          {c.issuer ? ` — ${c.issuer}` : ""}
                          {c.date ? ` (${c.date})` : ""}
                        </p>
                      ))
                    )}
                  </div>
                )}

                {/* Empty sections — quick add */}
                {!hasParsedResumeSections(data) && editingSection === null && (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "#6B6258" }}>
                    <p style={{ fontSize: 14, margin: "0 0 12px" }}>No structured content yet.</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                      {(["header", "summary", "experience", "education", "skills"] as SectionKey[]).map((s) => (
                        <button key={s} onClick={() => startEdit(s)} style={{ ...btnGhost, fontSize: 13 }}>
                          <Pencil size={12} /> Edit {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <style>{`
          @media print {
            body > *:not(.resume-print-outer) { display: none !important; }
            .resume-print-outer {
              position: static !important;
              display: block !important;
              padding: 0 !important;
            }
            .resume-print-backdrop { display: none !important; }
            .resume-print-target {
              display: flex !important;
              position: static !important;
              height: auto !important;
              max-width: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
              background: white !important;
            }
            .resume-print-hide { display: none !important; }
            .resume-print-center {
              flex: 1 !important;
              overflow: visible !important;
              padding: 0 !important;
            }
          }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

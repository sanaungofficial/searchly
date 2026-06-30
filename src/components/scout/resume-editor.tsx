"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, Trash2, Plus, Download, RefreshCw, Loader2, Check, ChevronDown } from "lucide-react";
import { CreditsStatusBar } from "@/components/scout/credits-display";
import { notifyCreditsChanged } from "@/lib/credits";
import { useWorkspace } from "@/contexts/workspace-context";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { ResumeStylePanel } from "./resume-style-panel";
import { TailoredResumePreview } from "./tailored-resume-preview";
import { BigScoreGauge } from "./job-match-ui";
import { fontSans, fontMono } from "@/lib/typography";
import {
  DEFAULT_RESUME_STYLE,
  normalizeResumeStyle,
  type ResumeStyleSettings,
} from "@/lib/resume-style";

interface ResumeSection {
  id: string;
  title: string;
  type: "text" | "bullets" | "header";
  content: string;
}

interface ResumeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle?: string;
  company?: string;
  updatedAt?: string;
  /** Opens match drawer at step 2 for explicit regenerate — not a silent re-run. */
  onRegenerateRequest?: () => void;
}

export function ResumeEditor({ open, onOpenChange, jobId, jobTitle, company, updatedAt: updatedAtProp, onRegenerateRequest }: ResumeEditorProps) {
  const router = useRouter();
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [previewSections, setPreviewSections] = useState<ResumeSection[] | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [fitToPage, setFitToPage] = useState(false);
  const [resumeStyle, setResumeStyle] = useState<ResumeStyleSettings>(DEFAULT_RESUME_STYLE);
  const [rightTab, setRightTab] = useState<"ai" | "editor" | "style">("editor");
  const [matchData, setMatchData] = useState<{ score: number; matched: string[]; missing: string[]; total: number } | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [injectedKeywords, setInjectedKeywords] = useState<string[]>([]);
  const [changeSummaries, setChangeSummaries] = useState<string[]>([]);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [newScore, setNewScore] = useState<number | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(updatedAtProp ?? null);
  const [stale, setStale] = useState(false);
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);
  const { openPricing, withClientScope } = useWorkspace();
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && jobId) {
      setLoading(true);
      setMatchData(null);
      setStale(false);
      fetch(withClientScope(`/api/resume/tailored/${jobId}`))
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.sections)) setSections(d.sections);
          if (d.updatedAt) setLastUpdated(d.updatedAt);
          if (d.stale) setStale(true);
          if (d.resumeStyle) setResumeStyle(normalizeResumeStyle(d.resumeStyle));
          if (Array.isArray(d.injectedKeywords)) setInjectedKeywords(d.injectedKeywords);
          if (Array.isArray(d.changes)) setChangeSummaries(d.changes);
          if (typeof d.previousScore === "number") setPreviousScore(d.previousScore);
          if (typeof d.newScore === "number") setNewScore(d.newScore);
          if (d.changes?.length || d.newScore != null) setRightTab("ai");
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      setMatchLoading(true);
      fetch(withClientScope(`/api/resume/tailored/${jobId}/match`))
        .then((r) => r.json())
        .then((d) => { if (typeof d.score === "number") setMatchData(d); })
        .catch(() => {})
        .finally(() => setMatchLoading(false));
    }
  }, [open, jobId]);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [downloadMenuOpen]);

  if (!open) return null;

  const activeSections = previewSections ?? sections;
  const style = normalizeResumeStyle(resumeStyle);
  const compactPreview = fitToPage || style.fitToOnePage;

  async function save(updated: ResumeSection[], styleOverride?: ResumeStyleSettings) {
    setSaving(true);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: updated,
          resumeStyle: styleOverride ?? resumeStyle,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.updatedAt) setLastUpdated(d.updatedAt);
      setStale(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function updateResumeStyle(next: ResumeStyleSettings) {
    setResumeStyle(next);
    if (sections.length) save(sections, next);
  }

  function updateSection(id: string, content: string) {
    const updated = sections.map((s) => s.id === id ? { ...s, content } : s);
    setSections(updated);
    save(updated);
  }

  function deleteSection(id: string) {
    const updated = sections.filter((s) => s.id !== id);
    setSections(updated);
    save(updated);
    if (editingId === id) setEditingId(null);
  }

  function addSection() {
    const newSection: ResumeSection = {
      id: `s-${Date.now()}`,
      title: "New Section",
      type: "text",
      content: "",
    };
    const updated = [...sections, newSection];
    setSections(updated);
    setEditingId(newSection.id);
    save(updated);
  }

  async function regenerate() {
    if (onRegenerateRequest) {
      setRegenerateConfirm(true);
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}/regenerate`), { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setPreviewSections(d.sections);
      }
    } finally {
      setRegenerating(false);
    }
  }

  function acceptRegenerate() {
    if (!previewSections) return;
    setSections(previewSections);
    save(previewSections);
    setPreviewSections(null);
    setMatchLoading(true);
      fetch(withClientScope(`/api/resume/tailored/${jobId}/match`))
      .then((r) => r.json())
      .then((d) => { if (typeof d.score === "number") setMatchData(d); })
      .catch(() => {})
      .finally(() => setMatchLoading(false));
  }

  async function downloadDocx() {
    setDownloading(true);
    setDownloadMenuOpen(false);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}/download?format=docx`));
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `resume-${company || "tailored"}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  }

  async function downloadPdf() {
    setDownloadMenuOpen(false);
    setDownloading(true);
    try {
      const res = await fetch(withClientScope(`/api/resume/tailored/${jobId}/download?format=pdf`));
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `resume-${company || "tailored"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
    } finally {
      setDownloading(false);
    }
    window.print();
  }

  function editBaseResume() {
    onOpenChange(false);
    router.push("/profile/assets");
  }

  function formatUpdatedAt(iso: string | null) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return null;
    }
  }

  return (
    <div
      className="resume-print-outer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "flex-end",
        fontFamily: "var(--font-ui), sans-serif",
      }}
    >
      {/* Backdrop */}
      <div
        className="resume-print-backdrop"
        onClick={() => onOpenChange(false)}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
        }}
      />
    <div
      className="resume-print-target bruddle"
      style={{
        position: "relative",
        width: "min(80vw, calc(100vw - 16px))",
        height: "100%",
        background: "#FFFFFF",
        borderLeft: "var(--scout-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "-4px 4px 0 #161616",
      }}
    >
      {/* Header bar */}
      <div
        className="resume-print-hide"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 56,
          borderBottom: "1px solid #E5DDD0",
          background: "#FDFAF5",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => onOpenChange(false)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "var(--scout-radius)", color: "#52493F" }}
          >
            <X size={16} />
          </button>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>View Your Tailored Resume</span>
            {formatUpdatedAt(lastUpdated) && (
              <span style={{ fontSize: 14, color: "var(--scout-muted)", marginLeft: 10 }}>
                Last updated {formatUpdatedAt(lastUpdated)}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && (
            <span style={{ fontSize: 14, color: "#1A3A2F", display: "flex", alignItems: "center", gap: 4 }}>
              <Check size={13} /> Saved
            </span>
          )}
          <button
            onClick={() => setFitToPage(!fitToPage)}
            style={{
              padding: "6px 14px",
              background: fitToPage ? "#1C3A2F" : "#F5F3EF",
              color: fitToPage ? "#E8D5A3" : "#52493F",
              border: "1px solid #D8D0C5",
              borderRadius: "var(--scout-radius)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Fit to one page
          </button>
          <button
            onClick={editBaseResume}
            style={{
              padding: "6px 14px",
              background: "#FFFFFF",
              color: "#52493F",
              border: "1px solid #D8D0C5",
              borderRadius: "var(--scout-radius)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Edit master resume
          </button>
        </div>
      </div>

      {/* Body — split preview + panel (Jobright-style) */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left — formatted resume preview */}
        <div
          style={{
            flex: "0 0 58%",
            background: "#F3F2EF",
            padding: "24px 28px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
          className="resume-print-center"
        >
          {loading ? (
            <KimchiProcessLoader
              preset="resumeTailor"
              title={`Loading tailored resume…`}
              variant="centered"
            />
          ) : activeSections.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 80, color: "var(--scout-muted)", maxWidth: 360 }}>
              <p style={{ fontSize: 14 }}>No tailored resume saved for this role yet.</p>
              <p style={{ fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
                Close this editor and use <strong>Customize your resume</strong> in the job drawer.
              </p>
            </div>
          ) : (
            <>
              {injectedKeywords.length > 0 && (
                <span
                  style={{
                    alignSelf: "flex-end",
                    marginBottom: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#15803D",
                    background: "rgba(134,239,172,0.25)",
                    padding: "3px 10px",
                    borderRadius: 999,
                  }}
                >
                  {injectedKeywords.length} keywords added
                </span>
              )}
              <div style={{ width: "100%", maxWidth: 640 }}>
                <TailoredResumePreview
                  sections={activeSections}
                  highlightKeywords={injectedKeywords}
                  resumeStyle={resumeStyle}
                  compact={compactPreview}
                />
              </div>
            </>
          )}

          {previewSections && (
            <div
              style={{
                marginTop: 20,
                padding: "14px 20px",
                background: "#1C3A2F",
                borderRadius: "var(--scout-radius)",
                display: "flex",
                alignItems: "center",
                gap: 14,
                maxWidth: 640,
                width: "100%",
              }}
            >
              <span style={{ fontSize: 13, color: "#E8D5A3", flex: 1 }}>AI has regenerated your resume. Accept to apply changes.</span>
              <button onClick={acceptRegenerate} style={{ padding: "7px 16px", background: "#E8D5A3", color: "#1C3A2F", border: "none", borderRadius: "var(--scout-radius)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Accept</button>
              <button onClick={() => setPreviewSections(null)} style={{ padding: "7px 16px", background: "transparent", color: "#E8D5A3", border: "1px solid rgba(232,213,163,0.4)", borderRadius: "var(--scout-radius)", fontSize: 14, cursor: "pointer" }}>Discard</button>
            </div>
          )}
        </div>

        {/* Right — AI Rewrite / Editor / Style */}
        <div
          className="resume-print-hide"
          style={{
            flex: 1,
            borderLeft: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            background: "#FFFFFF",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
            {(
              [
                { id: "ai" as const, label: "AI Rewrite" },
                { id: "editor" as const, label: "Editor" },
                { id: "style" as const, label: "Style" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRightTab(tab.id)}
                style={{
                  flex: 1,
                  padding: "12px 8px",
                  background: "none",
                  border: "none",
                  borderBottom: rightTab === tab.id ? "2px solid #1A3A2F" : "2px solid transparent",
                  fontSize: 13,
                  fontWeight: rightTab === tab.id ? 700 : 500,
                  color: rightTab === tab.id ? "#1A1A1A" : "#7A6E64",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: rightTab === "style" ? 0 : "16px 18px" }}>
            {rightTab === "ai" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {(newScore != null || changeSummaries.length > 0) && (
                  <div style={{ background: "var(--scout-inset)", borderRadius: "var(--scout-radius)", padding: 16, border: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
                    {newScore != null && (
                      <>
                        <BigScoreGauge score={newScore} />
                        {previousScore != null && (
                          <p style={{ fontSize: 13, color: "#52493F", marginTop: 8, marginBottom: 0 }}>
                            Score jumped from{" "}
                            <strong style={{ fontFamily: fontMono }}>
                              {previousScore.toFixed(1)} → {newScore.toFixed(1)}
                            </strong>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {changeSummaries.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>See What&apos;s Changed</p>
                    {changeSummaries.map((change, i) => (
                      <div key={i} style={{ display: "flex", gap: 9, padding: "9px 12px", background: "rgba(74,139,106,0.055)", borderRadius: "var(--scout-radius)", border: "1px solid rgba(74,139,106,0.12)", marginBottom: 7 }}>
                        <span style={{ color: "#3D7A5B" }}>•</span>
                        <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>{change}</p>
                      </div>
                    ))}
                  </div>
                )}
                {matchData && (
                  <div style={{ padding: "12px 14px", background: "#F5F3EF", borderRadius: "var(--scout-radius)", fontSize: 13, color: "#52493F" }}>
                    Keyword match: <strong>{matchData.score}%</strong>
                    {matchData.missing.length > 0 && ` · ${matchData.missing.length} still missing`}
                  </div>
                )}
              </div>
            )}

            {rightTab === "editor" && (
              <>
          <div style={{ padding: "0 0 14px", marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: "#52493F", background: "rgba(74,139,106,0.08)", padding: "10px 12px", borderRadius: "var(--scout-radius)", lineHeight: 1.5, margin: "0 0 10px" }}>
              Edits here apply only to this job. Update your base resume in Profile for changes that carry across roles.
            </p>
            <button
              type="button"
              onClick={editBaseResume}
              style={{ width: "100%", padding: "8px", background: "#FFFFFF", border: "1px solid #D8D0C5", borderRadius: "var(--scout-radius)", fontSize: 13, cursor: "pointer" }}
            >
              Edit base resume
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {activeSections.map((section) => (
              <div key={section.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 20px",
                    background: editingId === section.id ? "#F0EDE8" : "transparent",
                    borderLeft: editingId === section.id ? "2px solid #1C3A2F" : "2px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#1A1A1A", flex: 1 }}>{section.title}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => {
                        if (editingId === section.id) {
                          setEditingId(null);
                        } else {
                          setEditingId(section.id);
                          setEditDraft(section.content);
                        }
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--scout-muted)", display: "flex", alignItems: "center" }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => deleteSection(section.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--scout-muted)", display: "flex", alignItems: "center" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {editingId === section.id && (
                  <div style={{ padding: "8px 20px 14px" }}>
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={() => updateSection(section.id, editDraft)}
                      rows={6}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        border: "1px solid #D8D0C5",
                        borderRadius: "var(--scout-radius)",
                        fontSize: 14,
                        fontFamily: fontSans,
                        color: "#1A1A1A",
                        resize: "vertical",
                        background: "#FFFFFF",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                      placeholder={section.type === "bullets" ? "One bullet per line..." : "Section content..."}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: "12px 20px", borderTop: "1px solid #E5DDD0" }}>
            <button
              onClick={addSection}
              style={{
                width: "100%",
                padding: "8px 0",
                background: "transparent",
                border: "1px dashed #D8D0C5",
                borderRadius: "var(--scout-radius)",
                fontSize: 14,
                color: "#6B6258",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Plus size={13} /> Add
            </button>
          </div>
            </>
            )}

            {rightTab === "style" && (
              <ResumeStylePanel style={resumeStyle} onChange={updateResumeStyle} compact />
            )}
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div
        className="resume-print-hide"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 56,
          borderTop: "1px solid #E5DDD0",
          background: "#FDFAF5",
          flexShrink: 0,
        }}
      >
        <div ref={downloadRef} style={{ position: "relative" }}>
          <button
            onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
            disabled={downloading || loading || activeSections.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              background: "#1C3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: "var(--scout-radius)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              opacity: (downloading || loading || activeSections.length === 0) ? 0.5 : 1,
            }}
          >
            {downloading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
            Download Resume
            <ChevronDown size={13} />
          </button>
          {downloadMenuOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                left: 0,
                background: "#FFFFFF",
                border: "1px solid #E5DDD0",
                borderRadius: "var(--scout-radius)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                minWidth: 180,
                overflow: "hidden",
              }}
            >
              <button
                onClick={downloadPdf}
                style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "none", border: "none", fontSize: 13, color: "#1A1A1A", cursor: "pointer", display: "block" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F3EF")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                Download as PDF
              </button>
              <button
                onClick={downloadDocx}
                style={{ width: "100%", padding: "11px 16px", textAlign: "left", background: "none", border: "none", fontSize: 13, color: "#1A1A1A", cursor: "pointer", borderTop: "1px solid #F0EDE8", display: "block" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F3EF")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                Download as DOCX
              </button>
            </div>
          )}
        </div>

        <button
          onClick={regenerate}
          disabled={regenerating || loading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            background: "#86EFAC",
            color: "#1A1A1A",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            opacity: (regenerating || loading) ? 0.6 : 1,
          }}
        >
          {regenerating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
          Regenerate
        </button>
      </div>

      {regenerateConfirm && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "var(--scout-radius)",
              padding: "24px 28px",
              maxWidth: 380,
              boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
            }}
          >
            <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>Regenerate tailored resume?</p>
            <p style={{ fontFamily: fontSans, fontSize: 14, color: "#52493F", lineHeight: 1.55, margin: "0 0 20px" }}>
              This will run AI tailoring again for this job. Your current edits will be replaced.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setRegenerateConfirm(false)}
                style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(0,0,0,0.12)", borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: 14, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegenerateConfirm(false);
                  onRegenerateRequest?.();
                }}
                style={{ flex: 1, padding: "10px", background: "#86EFAC", color: "#1A1A1A", border: "none", borderRadius: "var(--scout-radius)", fontFamily: fontSans, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

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
      {showUpgrade && (
        <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </div>
    </div>
  );
}

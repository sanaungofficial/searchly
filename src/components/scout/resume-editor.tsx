"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil, Trash2, Plus, Download, RefreshCw, Loader2, Check, ChevronDown, Copy, FileText } from "lucide-react";

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
}

export function ResumeEditor({ open, onOpenChange, jobId, jobTitle, company, updatedAt }: ResumeEditorProps) {
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
  const [matchData, setMatchData] = useState<{ score: number; matched: string[]; missing: string[]; total: number } | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverCopied, setCoverCopied] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && jobId) {
      setLoading(true);
      setMatchData(null);
      fetch(`/api/resume/tailored/${jobId}`)
        .then((r) => r.json())
        .then((d) => { if (d.sections) setSections(d.sections); })
        .catch(() => {})
        .finally(() => setLoading(false));

      setMatchLoading(true);
      fetch(`/api/resume/tailored/${jobId}/match`)
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

  async function save(updated: ResumeSection[]) {
    setSaving(true);
    try {
      await fetch(`/api/resume/tailored/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: updated }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
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
    setRegenerating(true);
    try {
      const res = await fetch(`/api/resume/tailored/${jobId}/regenerate`, { method: "POST" });
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
    fetch(`/api/resume/tailored/${jobId}/match`)
      .then((r) => r.json())
      .then((d) => { if (typeof d.score === "number") setMatchData(d); })
      .catch(() => {})
      .finally(() => setMatchLoading(false));
  }

  async function downloadDocx() {
    setDownloading(true);
    setDownloadMenuOpen(false);
    try {
      const res = await fetch(`/api/resume/tailored/${jobId}/download?format=docx`);
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

  function downloadPdf() {
    setDownloadMenuOpen(false);
    window.print();
  }

  function editBaseResume() {
    onOpenChange(false);
    router.push("?tab=profile");
  }

  async function generateCoverLetter() {
    setCoverLoading(true);
    setCoverOpen(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "cover", company, role: jobTitle, jobId }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.text) setCoverLetter(d.text);
      }
    } finally {
      setCoverLoading(false);
    }
  }

  async function copyCoverLetter() {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
    setCoverCopied(true);
    setTimeout(() => setCoverCopied(false), 2000);
  }

  function downloadCoverLetterDocx() {
    if (!coverLetter) return;
    const blob = new Blob([coverLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter-${company || "application"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const personalInfo = activeSections.find((s) => s.type === "header");
  const contentSections = activeSections.filter((s) => s.type !== "header");

  return (
    <div
      className="resume-print-target"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#F2EDE3",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
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
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 5, color: "#52493F" }}
          >
            <X size={16} />
          </button>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>View Your Tailored Resume</span>
            {updatedAt && (
              <span style={{ fontSize: 11, color: "#A09890", marginLeft: 10 }}>Last updated {updatedAt}</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && (
            <span style={{ fontSize: 12, color: "#4A8B6A", display: "flex", alignItems: "center", gap: 4 }}>
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
              borderRadius: 5,
              fontSize: 12,
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
              borderRadius: 5,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Edit Base Resume
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left — job context */}
        <div
          className="resume-print-hide"
          style={{
            width: 260,
            borderRight: "1px solid #E5DDD0",
            padding: "28px 24px",
            overflowY: "auto",
            flexShrink: 0,
            background: "#FDFAF5",
          }}
        >
          {company && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: 8, background: "#1C3A2F",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <span style={{ color: "#E8D5A3", fontSize: 16, fontWeight: 700 }}>{company[0]}</span>
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>{company}</p>
              {jobTitle && <p style={{ fontSize: 12, color: "#6B6258", marginTop: 3 }}>{jobTitle}</p>}
            </div>
          )}
          {/* Match score */}
          <div style={{ marginBottom: 16 }}>
            {matchLoading ? (
              <div style={{ padding: "14px 16px", background: "#F5F3EF", borderRadius: 7, display: "flex", alignItems: "center", gap: 8 }}>
                <Loader2 size={13} style={{ color: "#A09890", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 11, color: "#7A6E64" }}>Analyzing keyword match…</span>
              </div>
            ) : matchData ? (
              <div style={{ padding: "14px 16px", background: "#FFFFFF", border: "1px solid #E5DDD0", borderRadius: 7 }}>
                {/* Score header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#52493F", textTransform: "uppercase", letterSpacing: 0.5 }}>Keyword Match</span>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: matchData.score >= 70 ? "#2E7D52" : matchData.score >= 40 ? "#B8860B" : "#C0392B",
                  }}>
                    {matchData.score}%
                  </span>
                </div>
                {/* Score bar */}
                <div style={{ height: 5, background: "#F0EDE8", borderRadius: 3, marginBottom: 12, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${matchData.score}%`,
                    background: matchData.score >= 70 ? "#2E7D52" : matchData.score >= 40 ? "#D4A017" : "#C0392B",
                    borderRadius: 3,
                    transition: "width 0.4s ease",
                  }} />
                </div>
                {/* Missing keywords */}
                {matchData.missing.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 5px" }}>
                      Missing ({matchData.missing.length})
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {matchData.missing.map((kw) => (
                        <span key={kw} style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          background: "#FFF0EE",
                          color: "#C0392B",
                          border: "1px solid #FADADD",
                          borderRadius: 10,
                        }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Matched keywords */}
                {matchData.matched.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 5px" }}>
                      Matched ({matchData.matched.length})
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {matchData.matched.map((kw) => (
                        <span key={kw} style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          background: "#F0FAF4",
                          color: "#2E7D52",
                          border: "1px solid #C8E6D0",
                          borderRadius: 10,
                        }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {matchData.missing.length > 0 && (
                  <p style={{ fontSize: 10, color: "#A09890", marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
                    Tip: Regenerate to incorporate missing keywords.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {/* Cover letter */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={coverOpen ? () => setCoverOpen(false) : generateCoverLetter}
              disabled={coverLoading}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: coverOpen ? "#F5F3EF" : "#1C3A2F",
                color: coverOpen ? "#52493F" : "#E8D5A3",
                border: coverOpen ? "1px solid #D8D0C5" : "none",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: coverLoading ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                opacity: coverLoading ? 0.7 : 1,
              }}
            >
              {coverLoading
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
                : coverOpen
                ? "Hide Cover Letter"
                : <><FileText size={13} /> Generate Cover Letter</>
              }
            </button>

            {coverOpen && (
              <div style={{ marginTop: 10, padding: "12px 14px", background: "#FFFFFF", border: "1px solid #E5DDD0", borderRadius: 7 }}>
                {coverLoading ? (
                  <p style={{ fontSize: 11, color: "#A09890", margin: 0 }}>Writing your cover letter…</p>
                ) : coverLetter ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
                      <button
                        onClick={copyCoverLetter}
                        style={{
                          padding: "4px 10px",
                          background: "#F5F3EF",
                          border: "1px solid #D8D0C5",
                          borderRadius: 4,
                          fontSize: 10,
                          color: "#52493F",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {coverCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                      </button>
                      <button
                        onClick={downloadCoverLetterDocx}
                        style={{
                          padding: "4px 10px",
                          background: "#F5F3EF",
                          border: "1px solid #D8D0C5",
                          borderRadius: 4,
                          fontSize: 10,
                          color: "#52493F",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Download size={11} /> Download
                      </button>
                      <button
                        onClick={generateCoverLetter}
                        style={{
                          padding: "4px 10px",
                          background: "#F5F3EF",
                          border: "1px solid #D8D0C5",
                          borderRadius: 4,
                          fontSize: 10,
                          color: "#52493F",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <RefreshCw size={11} /> Retry
                      </button>
                    </div>
                    <p style={{ fontSize: 11, color: "#1A1A1A", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
                      {coverLetter}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 11, color: "#A09890", margin: 0 }}>
                    Could not generate. Check that you have a resume uploaded and job notes added.
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              padding: "14px 16px",
              background: "#FFF8F0",
              border: "1px solid #F0E8D8",
              borderRadius: 7,
              fontSize: 11,
              color: "#7A6E64",
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "#C0392B", marginRight: 4 }}>⚠</span>
            Section order changes will be saved, other edits here apply only to this resume. For major updates like editing experiences, update your Base Resume to affect future resumes.
          </div>
        </div>

        {/* Middle — resume preview */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "32px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
          className="resume-print-center"
        >
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 80 }}>
              <Loader2 size={28} style={{ color: "#A09890", animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: 14, color: "#6B6258" }}>
                Tailoring your resume for {jobTitle}{company ? ` at ${company}` : ""}…
              </p>
            </div>
          ) : activeSections.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 80, color: "#A09890" }}>
              <p style={{ fontSize: 14 }}>No resume content yet.</p>
              <p style={{ fontSize: 12, marginTop: 6 }}>Upload a resume or click Regenerate.</p>
            </div>
          ) : (
            <div
              style={{
                background: "#FFFFFF",
                width: "100%",
                maxWidth: 720,
                padding: "52px 60px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.10)",
                borderRadius: 4,
                fontSize: fitToPage ? 10 : 11,
                lineHeight: 1.55,
                color: "#1A1A1A",
              }}
            >
              {/* Personal info header */}
              {personalInfo ? (
                <div style={{ textAlign: "center", marginBottom: 24, paddingBottom: 20, borderBottom: "1.5px solid #1A1A1A" }}>
                  {personalInfo.content.split("\n").map((line, i) => (
                    <p key={i} style={{ margin: 0, fontSize: i === 0 ? (fitToPage ? 18 : 22) : 10, fontWeight: i === 0 ? 700 : 400, letterSpacing: i === 0 ? 2 : 0, color: "#1A1A1A", lineHeight: i === 0 ? 1.2 : 1.8 }}>
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}

              {/* Content sections */}
              {contentSections.map((section) => (
                <div key={section.id} style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: fitToPage ? 9 : 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#1A1A1A", marginBottom: 6, borderBottom: "1px solid #1A1A1A", paddingBottom: 3 }}>
                    {section.title}
                  </p>
                  {section.type === "bullets" ? (
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {section.content.split("\n").filter(Boolean).map((b, i) => (
                        <li key={i} style={{ marginBottom: 3, fontSize: fitToPage ? 9 : 11 }}>{b.replace(/^[-•]\s*/, "")}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: fitToPage ? 9 : 11, whiteSpace: "pre-wrap" }}>{section.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Preview banner */}
          {previewSections && (
            <div
              style={{
                marginTop: 20,
                padding: "14px 20px",
                background: "#1C3A2F",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 14,
                maxWidth: 720,
                width: "100%",
              }}
            >
              <span style={{ fontSize: 13, color: "#E8D5A3", flex: 1 }}>AI has regenerated your resume. Accept to apply changes.</span>
              <button onClick={acceptRegenerate} style={{ padding: "7px 16px", background: "#E8D5A3", color: "#1C3A2F", border: "none", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Accept</button>
              <button onClick={() => setPreviewSections(null)} style={{ padding: "7px 16px", background: "transparent", color: "#E8D5A3", border: "1px solid rgba(232,213,163,0.4)", borderRadius: 5, fontSize: 12, cursor: "pointer" }}>Discard</button>
            </div>
          )}
        </div>

        {/* Right — section editor */}
        <div
          className="resume-print-hide"
          style={{
            width: 280,
            borderLeft: "1px solid #E5DDD0",
            display: "flex",
            flexDirection: "column",
            background: "#FDFAF5",
            flexShrink: 0,
          }}
        >
          <div style={{ padding: "20px 20px 0", borderBottom: "1px solid #E5DDD0", paddingBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#A09890", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>Sections</p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
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
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#1A1A1A", flex: 1 }}>{section.title}</span>
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
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#A09890", display: "flex", alignItems: "center" }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => deleteSection(section.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#A09890", display: "flex", alignItems: "center" }}
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
                        borderRadius: 5,
                        fontSize: 11,
                        fontFamily: "var(--font-dm-sans), system-ui",
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
                borderRadius: 5,
                fontSize: 12,
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
              borderRadius: 6,
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
                borderRadius: 7,
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
            padding: "10px 20px",
            background: "#4A8B6A",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            opacity: (regenerating || loading) ? 0.6 : 1,
          }}
        >
          {regenerating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
          Regenerate
        </button>
      </div>

      <style>{`
        @media print {
          body > *:not(.resume-print-target) { display: none !important; }
          .resume-print-target {
            display: flex !important;
            position: static !important;
            height: auto !important;
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
  );
}

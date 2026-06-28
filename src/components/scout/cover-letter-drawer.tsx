"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useWorkspace } from "@/contexts/workspace-context";
import { fontSans, drawerType as DT } from "@/lib/typography";
import { CreditsStatusBar } from "@/components/scout/credits-display";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { notifyCreditsChanged } from "@/lib/credits";
import { KimchiProcessLoader } from "@/components/scout/kimchi-process-loader";
import { scoutPrimaryCtaStyle } from "@/components/scout/scout-box";

interface CoverLetterDrawerProps {
  jobTitle: string;
  company: string;
  description: string;
  jobId?: string;
  initialLetter?: string | null;
  resumeAssetId?: string | null;
  onClose: () => void;
  onLetterSaved?: (letter: string) => void;
}

const QUICK_ACTIONS = [
  "Make the tone more confident and direct",
  "Tighten it up — cut the fluff",
  "Strengthen the opening paragraph",
  "Highlight my leadership and impact more",
];

async function streamInto(
  res: Response,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  while (true) {
    if (signal?.aborted) { reader.cancel(); return; }
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
  onChunk(decoder.decode());
}

export function CoverLetterDrawer({ jobTitle, company, description, jobId, initialLetter, resumeAssetId, onClose, onLetterSaved }: CoverLetterDrawerProps) {
  const { user, openPricing, withClientScope } = useWorkspace();
  const [letter, setLetter] = useState<string | null>(initialLetter?.trim() || null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ai" | "editor">("ai");
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);
  const [manualDesc, setManualDesc] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(resumeAssetId ?? null);

  useEffect(() => {
    if (resumeAssetId) setSelectedAssetId(resumeAssetId);
  }, [resumeAssetId]);

  useEffect(() => {
    fetch(withClientScope("/api/assets"))
      .then((r) => r.json())
      .then((rows: Array<{ id: string; type?: string; isPrimary?: boolean }>) => {
        if (!Array.isArray(rows)) return;
        const resumes = rows.filter((a) => a.type === "RESUME");
        if (selectedAssetId && resumes.some((r) => r.id === selectedAssetId)) return;
        const primary = resumes.find((r) => r.isPrimary) ?? resumes[0];
        if (primary) setSelectedAssetId(primary.id);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- init resume picker once
  }, [withClientScope]);

  const persistLetter = useCallback(
    (text: string) => {
      if (!jobId || !text.trim()) return;
      void fetch(withClientScope(`/api/jobs/${jobId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverLetter: text }),
      })
        .then((res) => {
          if (res.ok) onLetterSaved?.(text);
        })
        .catch(() => {});
    },
    [jobId, onLetterSaved, withClientScope],
  );

  useEffect(() => {
    if (!letter?.trim() || loading || streaming || refining) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistLetter(letter), 900);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [letter, loading, streaming, refining, persistLetter]);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function generate(overrideDesc?: string) {
    setLoading(true);
    setStreaming(false);
    setError(null);
    setLetter(null);
    abortRef.current = new AbortController();
    const desc = overrideDesc !== undefined ? overrideDesc : description;
    try {
      const res = await fetch("/api/ai/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          company,
          description: desc,
          jobId,
          assetId: selectedAssetId ?? undefined,
        }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Something went wrong" }));
        if (res.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
        }
        setError(d.error ?? "Couldn't generate a cover letter — try again.");
        setLoading(false);
        return;
      }
      let acc = "";
      let first = true;
      await streamInto(res, (chunk) => {
        if (first) { setLoading(false); setStreaming(true); first = false; }
        acc += chunk;
        setLetter(acc);
      }, abortRef.current.signal);
      setStreaming(false);
      notifyCreditsChanged();
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") setError("Something went wrong — try again.");
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  async function refine(prompt: string) {
    if (!letter || refining || streaming) return;
    setRefining(true);
    setStreaming(true);
    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/ai/refine-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentLetter: letter, prompt, jobTitle, company, description }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        if (res.status === 402) {
          notifyCreditsChanged();
          setShowUpgrade(true);
        }
        setRefining(false);
        setStreaming(false);
        return;
      }
      let acc = "";
      await streamInto(res, (chunk) => {
        acc += chunk;
        setLetter(acc);
      }, abortRef.current.signal);
      notifyCreditsChanged();
    } catch (e: unknown) {
      if (!(e instanceof Error && e.name === "AbortError")) {
        // silently ignore refinement errors
      }
    } finally {
      setRefining(false);
      setStreaming(false);
    }
  }

  function handleSend() {
    const q = chatInput.trim();
    if (!q || !letter || streaming) return;
    setChatInput("");
    refine(q);
  }

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    return () => abortRef.current?.abort();
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  function handleCopy() {
    if (!letter) return;
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleDownload() {
    if (!letter) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: letter, company }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cover-letter-${company || "application"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally {
      setDownloading(false);
    }
  }

  function handleDownloadPDF() {
    if (!letter) return;
    setShowDownloadMenu(false);
    const win = window.open("", "_blank");
    if (!win) return;
    const paras = (letter ?? "")
      .split("\n\n").filter(Boolean)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
    const html = "<!DOCTYPE html><html><head><title>Cover Letter</title>"
      + "<style>body{font-family:Georgia,serif;max-width:680px;margin:60px auto;"
      + "color:#1A1A1A;line-height:1.75;font-size:14px}p{margin-bottom:18px}"
      + "@media print{body{margin:40px}}</style></head>"
      + "<body>" + paras + "<script>window.onload=function(){window.print()}<\/script></body></html>";
    win.document.write(html);
    win.document.close();
  }

  const letterParas = (letter ?? "").split("\n\n").filter(Boolean);
  const isReady = !loading && !streaming && !!letter;

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 200,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.28s ease",
        }}
      />

      {/* Side drawer — matches ResumeMatchDrawer */}
      <div
        className="bruddle"
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "min(960px, 85vw)",
          background: "#FFFFFF",
          borderLeft: "var(--scout-border)",
          zIndex: 201,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 4px 0 #161616",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.32, 0, 0.16, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 24px",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "var(--scout-radius)",
                background: "#1A3A2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: fontSans,
                fontSize: 15,
                fontWeight: 700,
                color: "#E8D5A3",
                flexShrink: 0,
              }}
            >
              {company.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                Cover Letter
              </p>
              <p style={{ fontFamily: fontSans, fontSize: 14, color: "var(--scout-muted)", margin: "2px 0 0" }}>
                {jobTitle} · {company}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid rgba(0,0,0,0.1)",
              background: "rgba(0,0,0,0.03)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              color: "#52493F",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "12px 24px 0", flexShrink: 0 }}>
          <CreditsStatusBar onUpgrade={openPricing} />
        </div>

        {/* Body: document preview + controls */}
        <div
          style={{
            flex: 1,
            display: "flex",
            minHeight: 0,
            overflow: "hidden",
          }}
        >

          {/* ── LEFT: Document Preview ── */}
          <div
            style={{
              flex: "0 0 62%", background: "#EDEBE6",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
              {loading ? (
                <KimchiProcessLoader preset="coverLetter" variant="centered" />
              ) : !letter ? (
                <div style={{ paddingTop: 48, textAlign: "center", maxWidth: 360, margin: "0 auto" }}>
                  <p style={{ fontFamily: fontSans, fontSize: 14, color: "#6B7280", lineHeight: 1.6, marginBottom: 20 }}>
                    {error
                      ? error === "No resume found"
                        ? "Upload a resume under Profile first."
                        : error === "No job description provided"
                          ? "No job description on file — paste it in the panel on the right."
                          : "Couldn't generate a cover letter — try again."
                      : "Hit the button when you want a draft — we won't run it automatically."}
                  </p>
                  {error !== "No resume found" && (
                    <button
                      type="button"
                      onClick={() => generate()}
                      style={{
                        padding: "12px 20px",
                        ...scoutPrimaryCtaStyle,
                        fontFamily: fontSans,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Generate cover letter →
                    </button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "var(--scout-radius)",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
                    padding: "48px 52px",
                    minHeight: "100%",
                    fontFamily: "Georgia, 'Times New Roman', serif",
                  }}
                >
                  {/* Letterhead */}
                  <div style={{ marginBottom: 36, textAlign: "right" }}>
                    <div style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em" }}>
                      {user?.name ?? ""}
                    </div>
                    <div style={{ fontFamily: fontSans, fontSize: 14, color: "#6B7280", marginTop: 3 }}>
                      {user?.email ?? ""}
                    </div>
                  </div>

                  {/* Body */}
                  {letterParas.map((para, i) => (
                    <p
                      key={i}
                      style={{
                        fontSize: 13.5,
                        lineHeight: 1.75,
                        color: "#1A1A1A",
                        marginBottom: i < letterParas.length - 1 ? 18 : 0,
                      }}
                    >
                      {para}
                      {streaming && i === letterParas.length - 1 && (
                        <span style={{
                          display: "inline-block", width: 2, height: "1em",
                          background: "#1C3A2F", marginLeft: 2,
                          verticalAlign: "text-bottom",
                          animation: "blink 1s step-end infinite",
                        }} />
                      )}
                    </p>
                  ))}
                  <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Controls ── */}
          <div
            style={{
              flex: "0 0 38%",
              background: "#FAFAF8",
              display: "flex",
              flexDirection: "column",
              borderLeft: "1px solid rgba(0,0,0,0.08)",
              minWidth: 0,
            }}
          >
            {/* Tabs */}
            <div style={{
              display: "flex",
              borderBottom: "1px solid rgba(0,0,0,0.07)",
              flexShrink: 0,
            }}>
              {(["ai", "editor"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    background: "none",
                    border: "none",
                    borderBottom: activeTab === tab ? "2px solid #161616" : "2px solid transparent",
                    fontFamily: fontSans,
                    fontSize: 14,
                    fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? "#161616" : "#9CA3AF",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {tab === "ai" ? "AI Rewrite" : "Editor"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

              {/* AI Rewrite tab */}
              {activeTab === "ai" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>

                    {/* Status message */}
                    <div style={{
                      background: "#F0F4F1",
                      borderRadius: "var(--scout-radius)",
                      padding: "14px 16px",
                      marginBottom: 20,
                      fontFamily: fontSans,
                      fontSize: 14,
                      color: "#1C3A2F",
                      lineHeight: 1.5,
                    }}>
                      {loading
                        ? "Writing your cover letter…"
                        : streaming && !refining
                        ? "Still writing…"
                        : refining
                        ? "Rewriting from your note…"
                        : error
                        ? "Generation failed — try again below."
                        : !letter
                        ? "Generate when you're ready — it won't run on its own."
                        : "Draft's ready. Use a suggestion below or type your own edit."}
                    </div>

                    {/* No description error - paste input */}
                    {error === "No job description provided" && (
                      <div style={{ marginBottom: 16 }}>
                        <textarea
                          value={manualDesc}
                          onChange={(e) => setManualDesc(e.target.value)}
                          placeholder="Paste the job description here…"
                          rows={5}
                          style={{
                            width: "100%", padding: "10px 12px",
                            border: "1px solid rgba(0,0,0,0.12)", borderRadius: "var(--scout-radius)",
                            fontFamily: fontSans, fontSize: 14,
                            color: "#1A1A1A", resize: "none", background: "#FFFFFF",
                            lineHeight: 1.5, boxSizing: "border-box",
                          }}
                        />
                        <button
                          onClick={() => { if (manualDesc.trim()) { setError(null); generate(manualDesc.trim()); } }}
                          disabled={!manualDesc.trim()}
                          style={{
                            marginTop: 8, width: "100%", padding: "10px",
                            ...(manualDesc.trim() ? scoutPrimaryCtaStyle : {
                              background: "rgba(0,0,0,0.05)",
                              color: "var(--scout-muted)",
                              border: "none",
                            }),
                            borderRadius: "var(--scout-radius)",
                            fontFamily: fontSans,
                            fontSize: 14, fontWeight: 600,
                            cursor: manualDesc.trim() ? "pointer" : "not-allowed",
                          }}
                        >
                          Generate →
                        </button>
                      </div>
                    )}

                    {/* Quick action chips */}
                    {isReady && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {QUICK_ACTIONS.map((action) => (
                          <button
                            key={action}
                            onClick={() => refine(action)}
                            style={{
                              textAlign: "left",
                              padding: "10px 14px",
                              background: "#FFFFFF",
                              border: "1px solid rgba(0,0,0,0.1)",
                              borderRadius: "var(--scout-radius)",
                              fontFamily: fontSans,
                              fontSize: 14,
                              color: "#1A1A1A",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                              transition: "background 0.12s",
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = "#F5F3EF")}
                            onMouseOut={(e) => (e.currentTarget.style.background = "#FFFFFF")}
                          >
                            <span>{action}</span>
                            <span style={{ color: "#C9A84C", fontSize: 14, flexShrink: 0 }}>→</span>
                          </button>
                        ))}
                        <button
                          onClick={() => generate()}
                          style={{
                            marginTop: 4,
                            textAlign: "left",
                            padding: "10px 14px",
                            background: "none",
                            border: "1px dashed rgba(0,0,0,0.12)",
                            borderRadius: "var(--scout-radius)",
                            fontFamily: fontSans,
                            fontSize: 14,
                            color: "#9CA3AF",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>↺</span> Regenerate from scratch
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Chat input */}
                  <div style={{
                    padding: "14px 22px",
                    borderTop: "1px solid rgba(0,0,0,0.07)",
                    flexShrink: 0,
                    display: "flex", gap: 8, alignItems: "flex-end",
                  }}>
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                      }}
                      placeholder="Tell me what to change…"
                      rows={2}
                      disabled={!letter || streaming}
                      style={{
                        flex: 1, padding: "10px 12px",
                        border: "1px solid rgba(0,0,0,0.12)", borderRadius: "var(--scout-radius)",
                        fontFamily: fontSans, fontSize: 14,
                        color: "#1A1A1A", resize: "none", lineHeight: 1.4,
                        background: (!letter || streaming) ? "#F5F3EF" : "#FFFFFF",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!chatInput.trim() || !letter || streaming}
                      style={{
                        padding: "10px 16px",
                        ...(chatInput.trim() && letter && !streaming ? scoutPrimaryCtaStyle : {
                          background: "rgba(0,0,0,0.06)",
                          color: "var(--scout-muted)",
                          border: "none",
                        }),
                        borderRadius: "var(--scout-radius)",
                        fontFamily: fontSans,
                        fontSize: 14, fontWeight: 600,
                        cursor: (chatInput.trim() && letter && !streaming) ? "pointer" : "not-allowed",
                        whiteSpace: "nowrap", flexShrink: 0,
                        alignSelf: "stretch",
                        transition: "all 0.15s",
                      }}
                    >
                      Edit with AI
                    </button>
                  </div>
                </div>
              )}

              {/* Editor tab */}
              {activeTab === "editor" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{
                    padding: "14px 22px 10px",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: "#6B7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Cover letter text
                    </span>
                    <button
                      onClick={handleCopy}
                      style={{
                        padding: "5px 10px",
                        background: copied ? "#1C3A2F" : "#FFFFFF",
                        color: copied ? "#E8D5A3" : "#1A1A1A",
                        border: "1px solid rgba(0,0,0,0.12)", borderRadius: "var(--scout-radius)",
                        fontFamily: fontSans,
                        fontSize: 14, fontWeight: 500, cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <textarea
                    value={letter ?? ""}
                    onChange={(e) => setLetter(e.target.value)}
                    disabled={streaming}
                    style={{
                      flex: 1, padding: "16px 22px",
                      border: "none", outline: "none",
                      fontFamily: "Georgia, serif", fontSize: 13,
                      color: "#1A1A1A", lineHeight: 1.7,
                      resize: "none", background: "#FAFAF8",
                    }}
                  />
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{
              padding: "14px 22px",
              borderTop: "1px solid rgba(0,0,0,0.07)",
              flexShrink: 0,
              display: "flex", gap: 8, position: "relative",
            }}>
              {showDownloadMenu && (
                <>
                  <div onClick={() => setShowDownloadMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 6px)", left: 22,
                    background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.1)",
                    borderRadius: "var(--scout-radius)", boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
                    overflow: "hidden", minWidth: 220, zIndex: 20,
                  }}>
                    <button
                      onClick={handleDownloadPDF}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "12px 16px", background: "none", border: "none",
                        fontFamily: fontSans, fontSize: 13,
                        color: "#1A1A1A", cursor: "pointer",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "#F5F3EF")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                    >
                      Download by PDF
                    </button>
                    <div style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />
                    <button
                      onClick={() => { setShowDownloadMenu(false); handleDownload(); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "12px 16px", background: "none", border: "none",
                        fontFamily: fontSans, fontSize: 13,
                        color: "#1A1A1A", cursor: "pointer",
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = "#F5F3EF")}
                      onMouseOut={(e) => (e.currentTarget.style.background = "none")}
                    >
                      Download by Word(.docx)
                    </button>
                  </div>
                </>
              )}
              <button
                onClick={() => { if (letter && !streaming && !downloading) setShowDownloadMenu((v) => !v); }}
                disabled={!letter || streaming || downloading}
                style={{
                  flex: 1, padding: "11px 14px", background: "#FFFFFF",
                  color: (letter && !streaming) ? "#1A1A1A" : "var(--scout-muted)",
                  border: "1px solid rgba(0,0,0,0.15)", borderRadius: "var(--scout-radius)",
                  fontFamily: fontSans, fontSize: 13, fontWeight: 500,
                  cursor: (letter && !streaming && !downloading) ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "all 0.15s",
                }}
              >
                ↓ {downloading ? "Downloading…" : "Download"}
              </button>
              <button
                onClick={() => { if (!streaming) generate(); }}
                disabled={streaming}
                style={{
                  flex: 1, padding: "11px 14px",
                  ...(streaming ? {
                    background: "rgba(0,0,0,0.06)",
                    color: "var(--scout-muted)",
                    border: "none",
                  } : scoutPrimaryCtaStyle),
                  borderRadius: "var(--scout-radius)",
                  fontFamily: fontSans, fontSize: 13, fontWeight: 700,
                  cursor: streaming ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      </div>
      {showUpgrade && (
        <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </>,
    document.body,
  );
}

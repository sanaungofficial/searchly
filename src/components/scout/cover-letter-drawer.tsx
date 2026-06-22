"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";

interface CoverLetterDrawerProps {
  jobTitle: string;
  company: string;
  description: string;
  onClose: () => void;
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

export function CoverLetterDrawer({ jobTitle, company, description, onClose }: CoverLetterDrawerProps) {
  const { user } = useWorkspace();
  const [letter, setLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
  const abortRef = useRef<AbortController | null>(null);

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
        body: JSON.stringify({ jobTitle, company, description: desc }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: "Something went wrong" }));
        setError(d.error ?? "Something went wrong");
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
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") setError("Something went wrong");
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
      if (!res.ok) { setRefining(false); setStreaming(false); return; }
      let acc = "";
      await streamInto(res, (chunk) => {
        acc += chunk;
        setLetter(acc);
      }, abortRef.current.signal);
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
    generate();
    return () => abortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 300,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 301, padding: "24px 32px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%", maxWidth: 1160, height: "100%", maxHeight: 840,
            display: "flex", borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
            pointerEvents: "auto",
            transform: visible ? "scale(1)" : "scale(0.97)",
            opacity: visible ? 1 : 0,
            transition: "transform 0.2s ease, opacity 0.2s ease",
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <div style={{
                    width: 36, height: 36,
                    border: "2.5px solid rgba(0,0,0,0.1)",
                    borderTopColor: "#1C3A2F",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              ) : error && !letter ? (
                <div style={{ color: "#C4574A", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, paddingTop: 40 }}>
                  {error === "No resume found"
                    ? "Upload a resume in your profile first."
                    : error === "No job description provided"
                    ? "No description available for this job."
                    : "Could not generate a cover letter."}
                </div>
              ) : (
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 8,
                    boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
                    padding: "48px 52px",
                    minHeight: "100%",
                    fontFamily: "Georgia, 'Times New Roman', serif",
                  }}
                >
                  {/* Letterhead */}
                  <div style={{ marginBottom: 36, textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 15, fontWeight: 700, color: "#1A1A1A", letterSpacing: "-0.01em" }}>
                      {user?.name ?? ""}
                    </div>
                    <div style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#6B7280", marginTop: 3 }}>
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
            }}
          >
            {/* Right header */}
            <div style={{
              padding: "18px 22px",
              borderBottom: "1px solid rgba(0,0,0,0.07)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
                  Cover Letter
                </p>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {jobTitle} · {company}
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 30, height: 30, borderRadius: "50%",
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "#FFFFFF", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, color: "#6B7280",
                }}
              >
                ×
              </button>
            </div>

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
                    borderBottom: activeTab === tab ? "2px solid #1C3A2F" : "2px solid transparent",
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? "#1C3A2F" : "#9CA3AF",
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
                      borderRadius: 10,
                      padding: "14px 16px",
                      marginBottom: 20,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 12,
                      color: "#1C3A2F",
                      lineHeight: 1.5,
                    }}>
                      {loading
                        ? "Generating your cover letter…"
                        : streaming && !refining
                        ? "Writing your cover letter…"
                        : refining
                        ? "Rewriting based on your feedback…"
                        : error
                        ? "Couldn't generate a cover letter. Try again below."
                        : "Your cover letter is ready. Use the suggestions below or type your own instruction."}
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
                            border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8,
                            fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12,
                            color: "#1A1A1A", resize: "none", background: "#FFFFFF",
                            lineHeight: 1.5, boxSizing: "border-box",
                          }}
                        />
                        <button
                          onClick={() => { if (manualDesc.trim()) { setError(null); generate(manualDesc.trim()); } }}
                          disabled={!manualDesc.trim()}
                          style={{
                            marginTop: 8, width: "100%", padding: "10px",
                            background: manualDesc.trim() ? "#1C3A2F" : "rgba(0,0,0,0.05)",
                            color: manualDesc.trim() ? "#E8D5A3" : "#A09890",
                            border: "none", borderRadius: 8,
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 12, fontWeight: 600,
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
                              borderRadius: 8,
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 12,
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
                            borderRadius: 8,
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 12,
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
                      placeholder="Tell me how you'd like to tweak it…"
                      rows={2}
                      disabled={!letter || streaming}
                      style={{
                        flex: 1, padding: "10px 12px",
                        border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8,
                        fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12,
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
                        background: (chatInput.trim() && letter && !streaming) ? "#1C3A2F" : "rgba(0,0,0,0.06)",
                        color: (chatInput.trim() && letter && !streaming) ? "#E8D5A3" : "#A09890",
                        border: "none", borderRadius: 8,
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 12, fontWeight: 600,
                        cursor: (chatInput.trim() && letter && !streaming) ? "pointer" : "not-allowed",
                        whiteSpace: "nowrap", flexShrink: 0,
                        alignSelf: "stretch",
                        transition: "all 0.15s",
                      }}
                    >
                      Edit With AI
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
                    <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Cover Letter Text
                    </span>
                    <button
                      onClick={handleCopy}
                      style={{
                        padding: "5px 10px",
                        background: copied ? "#1C3A2F" : "#FFFFFF",
                        color: copied ? "#E8D5A3" : "#1A1A1A",
                        border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6,
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 11, fontWeight: 500, cursor: "pointer",
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
            }}>
              <button
                onClick={handleDownload}
                disabled={!letter || streaming || downloading}
                style={{
                  width: "100%", padding: "12px",
                  background: (letter && !streaming && !downloading) ? "#1C3A2F" : "rgba(0,0,0,0.06)",
                  color: (letter && !streaming && !downloading) ? "#E8D5A3" : "#A09890",
                  border: "none", borderRadius: 8,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12, fontWeight: 600,
                  cursor: (letter && !streaming && !downloading) ? "pointer" : "not-allowed",
                  transition: "all 0.15s",
                }}
              >
                {downloading ? "Downloading…" : "Download as Word doc →"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

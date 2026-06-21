"use client";

import { useEffect, useRef, useState } from "react";

interface CoverLetterDrawerProps {
  jobTitle: string;
  company: string;
  description: string;
  onClose: () => void;
}

export function CoverLetterDrawer({ jobTitle, company, description, onClose }: CoverLetterDrawerProps) {
  const [letter, setLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [manualDesc, setManualDesc] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  function generate(overrideDesc?: string) {
    setLoading(true);
    setError(null);
    setLetter(null);

    abortRef.current = new AbortController();
    const desc = overrideDesc !== undefined ? overrideDesc : description;

    fetch("/api/ai/generate-cover-letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle, company, description: desc }),
      signal: abortRef.current.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setLetter(d.letter);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError("Something went wrong");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    generate();
    return () => abortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 250);
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
    } catch {
      // silently fail on download
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.1)",
          zIndex: 200,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          bottom: 8,
          width: 480,
          background: "#FAF7F2",
          borderRadius: 12,
          zIndex: 201,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <button
            onClick={handleClose}
            style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.1)", background: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#52493F", flexShrink: 0 }}
          >
            ×
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>Cover Letter</p>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#A09890", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{jobTitle} · {company}</p>
          </div>
          {letter && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => generate()}
                title="Regenerate"
                style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(0,0,0,0.1)", background: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#52493F" }}
              >
                ↺
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 }}>
              <div style={{ width: 32, height: 32, border: "2px solid rgba(0,0,0,0.08)", borderTopColor: "#1A3A2F", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>Writing your cover letter…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{ paddingTop: 20 }}>
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#C4574A", marginBottom: error === "No job description provided" ? 14 : 0 }}>
                {error === "No resume found"
                  ? "Upload a resume in your profile to generate a cover letter."
                  : error === "No job description provided"
                  ? "This job doesn't have a description stored. Paste it below:"
                  : "Couldn't generate a cover letter. Try again."}
              </p>
              {error === "No job description provided" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <textarea
                    value={manualDesc}
                    onChange={(e) => setManualDesc(e.target.value)}
                    placeholder="Paste the job description here…"
                    rows={8}
                    style={{
                      width: "100%",
                      padding: "12px",
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 8,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 12,
                      color: "#1A1A1A",
                      resize: "vertical",
                      background: "#FFFFFF",
                      lineHeight: 1.6,
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={() => { if (manualDesc.trim()) generate(manualDesc.trim()); }}
                    disabled={!manualDesc.trim()}
                    style={{
                      padding: "11px",
                      background: manualDesc.trim() ? "#1A3A2F" : "rgba(0,0,0,0.05)",
                      color: manualDesc.trim() ? "#E8D5A3" : "#A09890",
                      border: "none",
                      borderRadius: 8,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: manualDesc.trim() ? "pointer" : "not-allowed",
                    }}
                  >
                    Generate Cover Letter →
                  </button>
                </div>
              )}
            </div>
          )}

          {letter && (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.06)",
                padding: "20px 22px",
              }}
            >
              {letter.split("\n\n").map((para, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 13,
                    color: "#1A1A1A",
                    lineHeight: 1.7,
                    marginBottom: i < letter.split("\n\n").length - 1 ? 16 : 0,
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {letter && (
          <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, display: "flex", gap: 8 }}>
            <button
              onClick={handleCopy}
              style={{
                flex: 1,
                padding: "11px",
                background: copied ? "#4A8B6A" : "#FFFFFF",
                color: copied ? "#FFFFFF" : "#1A1A1A",
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 8,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {copied ? "Copied!" : "Copy text"}
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                flex: 2,
                padding: "11px",
                background: "#1A3A2F",
                color: "#E8D5A3",
                border: "none",
                borderRadius: 8,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 600,
                cursor: downloading ? "wait" : "pointer",
                opacity: downloading ? 0.7 : 1,
              }}
            >
              {downloading ? "Downloading…" : "Download as Word doc →"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

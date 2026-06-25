"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export type ResumeUploadJob = {
  assetId: string;
  defaultName: string;
  phase: "analyzing" | "success";
};

const STORAGE_KEY = "kimchi_resume_upload_job";
const POLL_MS = 3500;

export function loadResumeUploadJob(): ResumeUploadJob | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeUploadJob;
    if (!parsed?.assetId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveResumeUploadJob(job: ResumeUploadJob | null) {
  if (typeof window === "undefined") return;
  if (!job) sessionStorage.removeItem(STORAGE_KEY);
  else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(job));
}

type AssetStatus = {
  parseStatus: "running" | "complete" | "failed" | null;
  parseError?: string | null;
  name?: string;
};

function modalOverlay(onClose?: () => void) {
  return {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1100,
    padding: 16,
    onClick: onClose,
  };
}

function modalCard() {
  return {
    background: "#FFFFFF",
    borderRadius: 16,
    padding: "40px 32px 32px",
    width: 480,
    maxWidth: "92vw",
    position: "relative" as const,
    boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
  };
}

export function ResumeAnalyzingModal({
  onContinueBrowsing,
  onCancel,
  isMobile,
}: {
  onContinueBrowsing: () => void;
  onCancel: () => void;
  isMobile?: boolean;
}) {
  return (
    <div {...modalOverlay()}>
      <div style={{ ...modalCard(), padding: isMobile ? "36px 24px 28px" : "40px 32px 32px" }}>
        <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 22, fontWeight: 700, color: "#1A1A1A", margin: "0 0 20px", textAlign: "center" }}>
          Analyzing Your Resume
        </h2>
        <div style={{ height: 8, background: "#E8E8E8", borderRadius: 999, overflow: "hidden", marginBottom: 20 }}>
          <div
            style={{
              height: "100%",
              width: "40%",
              background: "linear-gradient(90deg, #6EE7B7, #34D399)",
              borderRadius: 999,
              animation: "resumeParseBar 1.4s ease-in-out infinite",
            }}
          />
        </div>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#6B6258", textAlign: "center", lineHeight: 1.55, margin: "0 0 28px" }}>
          Tip: We&apos;ll notify you as soon as analysis is complete. Feel free to continue browsing Kimchi in the meantime!
        </p>
        <button
          type="button"
          onClick={onContinueBrowsing}
          style={{
            width: "100%",
            padding: "14px 0",
            minHeight: 48,
            background: "#1A1A1A",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
            marginBottom: 12,
          }}
        >
          Continue Browsing
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            width: "100%",
            padding: "14px 0",
            minHeight: 48,
            background: "#FFFFFF",
            color: "#1A1A1A",
            border: "1px solid #D8D0C5",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
          }}
        >
          Cancel Upload
        </button>
        <style>{`
          @keyframes resumeParseBar {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(320%); }
          }
        `}</style>
      </div>
    </div>
  );
}

export function ResumeUploadSuccessModal({
  defaultName,
  saving,
  onSave,
  onViewResume,
  isMobile,
}: {
  defaultName: string;
  saving: boolean;
  onSave: (name: string, targetJobTitle: string) => void;
  onViewResume: () => void;
  isMobile?: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [targetJobTitle, setTargetJobTitle] = useState("");

  return (
    <div {...modalOverlay()}>
      <div style={{ ...modalCard(), padding: isMobile ? "36px 24px 28px" : "40px 32px 32px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
            🙂
          </div>
        </div>
        <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 22, fontWeight: 700, color: "#1A1A1A", margin: "0 0 8px", textAlign: "center" }}>
          Upload Success!
        </h2>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#6B6258", textAlign: "center", margin: "0 0 24px" }}>
          Let&apos;s confirm a few details for future reference.
        </p>
        <label style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
          Resume Name <span style={{ color: "#C4574A" }}>*</span>
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1px solid #D8D0C5",
            borderRadius: 8,
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            marginBottom: 16,
            boxSizing: "border-box",
          }}
        />
        <label style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
          Target Job Title
        </label>
        <input
          value={targetJobTitle}
          onChange={(e) => setTargetJobTitle(e.target.value)}
          placeholder="Enter the job title you're aiming for (e.g., Product Manager)"
          style={{
            width: "100%",
            padding: "12px 14px",
            border: "1px solid #D8D0C5",
            borderRadius: 8,
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            marginBottom: 24,
            boxSizing: "border-box",
          }}
        />
        <button
          type="button"
          onClick={onViewResume}
          style={{
            width: "100%",
            padding: "14px 0",
            minHeight: 48,
            background: "#1A1A1A",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
            marginBottom: 12,
          }}
        >
          View My Resume
        </button>
        <button
          type="button"
          disabled={!name.trim() || saving}
          onClick={() => onSave(name.trim(), targetJobTitle.trim())}
          style={{
            width: "100%",
            padding: "14px 0",
            minHeight: 48,
            background: "#FFFFFF",
            color: "#1A1A1A",
            border: "1px solid #D8D0C5",
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            cursor: !name.trim() || saving ? "not-allowed" : "pointer",
            opacity: !name.trim() || saving ? 0.6 : 1,
            fontFamily: "var(--font-ui)",
          }}
        >
          {saving ? "Saving…" : "Update to Profile"}
        </button>
      </div>
    </div>
  );
}

export function useResumeUploadFlow(options: {
  onComplete: () => void;
  onFailed: (message: string) => void;
  onCancel: (assetId: string) => Promise<void>;
}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [job, setJob] = useState<ResumeUploadJob | null>(null);
  const [showAnalyzingModal, setShowAnalyzingModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const jobRef = useRef<ResumeUploadJob | null>(null);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  useEffect(() => {
    const stored = loadResumeUploadJob();
    if (stored) {
      setJob(stored);
      setShowAnalyzingModal(stored.phase === "analyzing");
      setShowSuccessModal(stored.phase === "success");
    }
  }, []);

  const clearJob = useCallback(() => {
    setJob(null);
    setShowAnalyzingModal(false);
    setShowSuccessModal(false);
    saveResumeUploadJob(null);
  }, []);

  const startJob = useCallback((assetId: string, defaultName: string) => {
    const next: ResumeUploadJob = { assetId, defaultName, phase: "analyzing" };
    setJob(next);
    setShowAnalyzingModal(true);
    setShowSuccessModal(false);
    saveResumeUploadJob(next);
  }, []);

  const pollAsset = useCallback(async () => {
    const current = jobRef.current;
    if (!current || current.phase !== "analyzing") return;
    try {
      const res = await fetch(`/api/assets/${current.assetId}`);
      const data = (await res.json()) as AssetStatus & { error?: string };
      if (!res.ok) return;
      if (data.parseStatus === "complete") {
        const next: ResumeUploadJob = { ...current, phase: "success" };
        setJob(next);
        saveResumeUploadJob(next);
        setShowAnalyzingModal(false);
        setShowSuccessModal(true);
        optionsRef.current.onComplete();
      } else if (data.parseStatus === "failed") {
        clearJob();
        optionsRef.current.onFailed(data.parseError || "Resume analysis failed.");
      }
    } catch {
      /* ignore transient poll errors */
    }
  }, [clearJob]);

  useEffect(() => {
    if (!job || job.phase !== "analyzing") return;
    void pollAsset();
    const id = window.setInterval(() => void pollAsset(), POLL_MS);
    return () => window.clearInterval(id);
  }, [job, pollAsset]);

  const continueBrowsing = useCallback(() => {
    setShowAnalyzingModal(false);
  }, []);

  const cancelUpload = useCallback(async () => {
    const current = jobRef.current;
    if (!current) return;
    clearJob();
    await optionsRef.current.onCancel(current.assetId);
  }, [clearJob]);

  const finishSuccess = useCallback(async (name: string, targetJobTitle: string) => {
    const current = jobRef.current;
    if (!current) return;
    setSavingMeta(true);
    try {
      await fetch(`/api/assets/${current.assetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetJobTitle: targetJobTitle || null }),
      });
      clearJob();
      optionsRef.current.onComplete();
    } finally {
      setSavingMeta(false);
    }
  }, [clearJob]);

  const viewResume = useCallback(() => {
    const current = jobRef.current;
    if (!current) return;
    clearJob();
    return current.assetId;
  }, [clearJob]);

  return {
    job,
    showAnalyzingModal,
    showSuccessModal,
    savingMeta,
    startJob,
    continueBrowsing,
    cancelUpload,
    finishSuccess,
    viewResume,
    clearJob,
  };
}

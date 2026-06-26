"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  ScoutDisplayTitle,
  ScoutLabel,
  ScoutPrimaryBtn,
  ScoutSecondaryBtn,
} from "./scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

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

function useModalPortal() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function ResumeUploadModalShell({
  children,
  label,
  isMobile,
}: {
  children: React.ReactNode;
  label: string;
  isMobile?: boolean;
}) {
  const mounted = useModalPortal();
  if (!mounted) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 16 : 24,
      }}
    >
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }}
      />
      <div
        role="dialog"
        aria-labelledby="resume-upload-modal-title"
        style={{
          position: "relative",
          background: surface.card,
          border: border.lineStrong,
          padding: isMobile ? "32px 24px 28px" : "40px 36px 32px",
          width: 480,
          maxWidth: "92vw",
          boxShadow: "4px 4px 0 rgba(17,17,17,0.06)",
        }}
      >
        <ScoutLabel>{label}</ScoutLabel>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontFamily: fontSans,
  fontSize: T.caption,
  fontWeight: 600,
  color: color.ink,
  marginBottom: 6,
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: border.lineStrong,
  borderRadius: "var(--scout-radius)",
  background: surface.card,
  fontFamily: fontSans,
  fontSize: T.bodySm,
  color: color.ink,
  marginBottom: 16,
  boxSizing: "border-box",
};

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
    <ResumeUploadModalShell label="Resume analysis" isMobile={isMobile}>
      <ScoutDisplayTitle
        size={22}
        style={{ margin: "10px 0 20px", textAlign: "center" }}
      >
        <span id="resume-upload-modal-title">Analyzing your resume</span>
      </ScoutDisplayTitle>
      <div
        style={{
          height: 6,
          background: surface.inset,
          border: border.line,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            height: "100%",
            width: "36%",
            background: color.forest,
            animation: "resumeParseBar 1.4s ease-in-out infinite",
          }}
        />
      </div>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.bodySm,
          color: color.muted,
          textAlign: "center",
          lineHeight: 1.6,
          margin: "0 0 28px",
        }}
      >
        Tip: We&apos;ll notify you when analysis finishes. You can keep browsing in the meantime.
      </p>
      <ScoutPrimaryBtn
        onClick={onContinueBrowsing}
        style={{ width: "100%", padding: "14px 0", minHeight: 44, marginBottom: 10, justifyContent: "center" }}
      >
        Continue browsing
      </ScoutPrimaryBtn>
      <ScoutSecondaryBtn
        onClick={onCancel}
        style={{ width: "100%", padding: "14px 0", minHeight: 44, justifyContent: "center" }}
      >
        Cancel upload
      </ScoutSecondaryBtn>
      <style>{`
        @keyframes resumeParseBar {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </ResumeUploadModalShell>
  );
}

export function ResumeUploadSuccessModal({
  defaultName,
  saving,
  onSave,
  onViewResume,
  isMobile,
  targetRoles = [],
}: {
  defaultName: string;
  saving: boolean;
  onSave: (name: string, targetJobTitle: string) => void;
  onViewResume: () => void;
  isMobile?: boolean;
  targetRoles?: string[];
}) {
  const [name, setName] = useState(defaultName);
  const [targetJobTitle, setTargetJobTitle] = useState(targetRoles[0] ?? "");
  const [customRole, setCustomRole] = useState(false);

  return (
    <ResumeUploadModalShell label="Resume upload" isMobile={isMobile}>
      <div style={{ display: "flex", justifyContent: "center", margin: "12px 0 16px" }}>
        <div
          style={{
            width: 48,
            height: 48,
            background: color.forest,
            border: border.lineStrong,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color.gold,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          ✓
        </div>
      </div>
      <ScoutDisplayTitle size={22} style={{ margin: "0 0 8px", textAlign: "center" }}>
        <span id="resume-upload-modal-title">Resume parsed</span>
      </ScoutDisplayTitle>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.bodySm,
          color: color.muted,
          textAlign: "center",
          margin: "0 0 24px",
          lineHeight: 1.6,
        }}
      >
        Name your file and add a target title if you want — both optional except the name.
      </p>
      <label style={fieldLabel}>
        Resume name <span style={{ color: "#C4574A" }}>*</span>
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={fieldInput}
      />
      <label style={fieldLabel}>Target role</label>
      {targetRoles.length > 0 && !customRole ? (
        <select
          value={targetJobTitle}
          onChange={(e) => setTargetJobTitle(e.target.value)}
          style={{ ...fieldInput, marginBottom: 8 }}
        >
          <option value="">Select a target role (optional)</option>
          {targetRoles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      ) : (
        <input
          value={targetJobTitle}
          onChange={(e) => setTargetJobTitle(e.target.value)}
          placeholder="Target role you're aiming for"
          style={{ ...fieldInput, marginBottom: 8 }}
        />
      )}
      {targetRoles.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setCustomRole((v) => !v);
            if (!customRole) setTargetJobTitle("");
            else setTargetJobTitle(targetRoles[0] ?? "");
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            marginBottom: 24,
            fontFamily: fontSans,
            fontSize: T.caption,
            color: color.forest,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          {customRole ? "Pick from my target roles" : "Enter a custom role instead"}
        </button>
      )}
      {!targetRoles.length && <div style={{ marginBottom: 24 }} />}
      <ScoutPrimaryBtn
        onClick={onViewResume}
        style={{ width: "100%", padding: "14px 0", minHeight: 44, marginBottom: 10, justifyContent: "center" }}
      >
        View my resume
      </ScoutPrimaryBtn>
      <ScoutSecondaryBtn
        disabled={!name.trim() || saving}
        onClick={() => onSave(name.trim(), targetJobTitle.trim())}
        style={{
          width: "100%",
          padding: "14px 0",
          minHeight: 44,
          justifyContent: "center",
          opacity: !name.trim() || saving ? 0.6 : 1,
          cursor: !name.trim() || saving ? "not-allowed" : "pointer",
        }}
      >
        {saving ? "Saving…" : "Update to profile"}
      </ScoutSecondaryBtn>
    </ResumeUploadModalShell>
  );
}

export function useResumeUploadFlow(options: {
  onComplete: () => void;
  onFailed: (message: string) => void;
  onCancel: (assetId: string) => Promise<void>;
  assetApiUrl?: (id: string) => string;
}) {
  const { withClientScope } = useWorkspace();
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
      const assetUrl =
        optionsRef.current.assetApiUrl?.(current.assetId) ??
        withClientScope(`/api/assets/${current.assetId}`);
      const res = await fetch(assetUrl);
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
        optionsRef.current.onFailed(data.parseError || "Resume analysis failed — try uploading again.");
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
      const assetUrl =
        optionsRef.current.assetApiUrl?.(current.assetId) ??
        withClientScope(`/api/assets/${current.assetId}`);
      await fetch(assetUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetJobTitle: targetJobTitle || null }),
      });
      clearJob();
      optionsRef.current.onComplete();
    } finally {
      setSavingMeta(false);
    }
  }, [clearJob, withClientScope]);

  const viewResume = useCallback(() => {
    const current = jobRef.current;
    if (!current) return;
    clearJob();
    return current.assetId;
  }, [clearJob, withClientScope]);

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

"use client";

import React, { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn } from "./scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  open: boolean;
  onClose: () => void;
  onFilesSelected: (files: File[]) => void;
  uploading?: boolean;
  accept?: string;
  multiple?: boolean;
  label?: string;
  title?: string;
  hint?: string;
  dropHint?: string;
};

function DocumentUploadIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="10" width="65" height="82" rx="6" fill="#F5F5F5" stroke="#D0D0D0" strokeWidth="2" />
      <rect x="28" y="24" width="42" height="4" rx="2" fill="#D0D0D0" />
      <rect x="28" y="34" width="36" height="4" rx="2" fill="#D0D0D0" />
      <rect x="28" y="44" width="40" height="4" rx="2" fill="#D0D0D0" />
      <rect x="28" y="54" width="32" height="4" rx="2" fill="#D0D0D0" />
      <circle cx="85" cy="85" r="20" fill={color.forest} />
      <path d="M85 77v16M77 85l8-8 8 8" stroke={color.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UploadDocumentModal({
  open,
  onClose,
  onFilesSelected,
  uploading = false,
  accept = ".pdf,.doc,.docx",
  multiple = true,
  label = "Document upload",
  title = "Upload a document",
  hint = "PDF or Word format · max 10MB",
  dropHint = "Drop files here or click to browse",
}: Props) {
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) setIsDragging(false);
  }, [open]);

  const pickFiles = useCallback(() => {
    if (!uploading) inputRef.current?.click();
  }, [uploading]);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length || uploading) return;
      onFilesSelected(Array.from(fileList));
    },
    [onFilesSelected, uploading],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) setIsDragging(true);
  }, [uploading]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  if (!open || !mounted) return null;

  const dropBorder = isDragging ? color.forest : "rgba(26,58,47,0.25)";
  const dropBg = isDragging ? "rgba(26,58,47,0.06)" : surface.inset;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: isMobile ? 16 : 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="upload-document-modal-title"
        style={{
          background: surface.card,
          border: border.lineStrong,
          padding: isMobile ? "36px 24px 28px" : "44px 40px 36px",
          width: 540,
          maxWidth: "90vw",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "4px 4px 0 rgba(17,17,17,0.06)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 32,
            height: 32,
            background: color.forest,
            border: border.line,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color.gold,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          ✕
        </button>

        <ScoutLabel>{label}</ScoutLabel>
        <ScoutDisplayTitle size={22} style={{ margin: "10px 0 24px", textAlign: "center" }}>
          <span id="upload-document-modal-title">{title}</span>
        </ScoutDisplayTitle>

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={pickFiles}
          style={{
            width: "100%",
            maxWidth: 360,
            minHeight: 180,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "24px 20px",
            marginBottom: 20,
            border: `2px dashed ${dropBorder}`,
            background: dropBg,
            cursor: uploading ? "not-allowed" : "pointer",
            transition: "border-color 0.2s, background 0.2s",
            userSelect: "none",
          }}
        >
          <DocumentUploadIcon />
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.bodySm,
                fontWeight: 600,
                color: color.ink,
                margin: "0 0 6px",
              }}
            >
              {dropHint}
            </p>
            <p
              style={{
                fontFamily: fontSans,
                fontSize: T.caption,
                color: color.muted,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {hint}
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <ScoutPrimaryBtn
          onClick={pickFiles}
          disabled={uploading}
          style={{ width: "100%", padding: "14px 0", minHeight: 44, opacity: uploading ? 0.6 : 1, justifyContent: "center" }}
        >
          {uploading ? "Uploading…" : "Choose file"}
        </ScoutPrimaryBtn>
      </div>
    </div>,
    document.body,
  );
}

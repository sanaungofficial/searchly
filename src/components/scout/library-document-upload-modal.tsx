"use client";

import React, { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LIBRARY_DOCUMENT_UPLOAD_OPTIONS,
  type LibraryDocumentType,
} from "@/lib/asset-types";
import { ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { border, color, fontSans, radius, shadow, surface, type as T } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, type: LibraryDocumentType) => void;
  uploading?: boolean;
};

function DocumentUploadIcon() {
  return (
    <svg width="96" height="96" viewBox="0 0 120 120" fill="none" aria-hidden>
      <rect x="20" y="10" width="65" height="82" rx="6" fill="#F5F5F5" stroke="#D0D0D0" strokeWidth="2" />
      <rect x="28" y="24" width="42" height="4" rx="2" fill="#D0D0D0" />
      <rect x="28" y="34" width="36" height="4" rx="2" fill="#D0D0D0" />
      <circle cx="85" cy="85" r="20" fill={color.forest} />
      <path d="M85 77v16M77 85l8-8 8 8" stroke={color.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LibraryDocumentUploadModal({ open, onClose, onUpload, uploading = false }: Props) {
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<LibraryDocumentType>("JOB_SEARCH_STRATEGY");
  const [dragging, setDragging] = useState(false);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setDocType("JOB_SEARCH_STRATEGY");
      setDragging(false);
    }
  }, [open]);

  const pickFile = useCallback(() => {
    if (!uploading) inputRef.current?.click();
  }, [uploading]);

  const handleFile = useCallback((f: File | null) => {
    if (!f || uploading) return;
    setFile(f);
  }, [uploading]);

  const submit = () => {
    if (!file || uploading) return;
    onUpload(file, docType);
  };

  if (!open || !mounted) return null;

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
        style={{
          background: surface.card,
          border: border.lineStrong,
          borderRadius: radius.box,
          padding: isMobile ? "28px 20px 24px" : "36px 32px 28px",
          width: 560,
          maxWidth: "92vw",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: shadow.cardStrong,
        }}
      >
        <ScoutLabel>File library</ScoutLabel>
        <ScoutDisplayTitle size={22} style={{ margin: "8px 0 6px" }}>
          Upload a document
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 20px", lineHeight: 1.55 }}>
          Choose a file, then pick what kind of document it is. It will appear in your library with that label.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          onClick={pickFile}
          style={{
            border: `2px dashed ${dragging ? color.forest : "rgba(26,58,47,0.25)"}`,
            borderRadius: radius.box,
            background: dragging ? "rgba(26,58,47,0.06)" : surface.inset,
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            cursor: uploading ? "not-allowed" : "pointer",
            marginBottom: 20,
          }}
        >
          <DocumentUploadIcon />
          {file ? (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: 0, textAlign: "center" }}>
              {file.name}
            </p>
          ) : (
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, textAlign: "center" }}>
              Drop a file here or click to browse · PDF or Word
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
          Document type
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
          {LIBRARY_DOCUMENT_UPLOAD_OPTIONS.map((opt) => {
            const selected = docType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDocType(opt.value)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  border: selected ? border.lineStrong : border.line,
                  background: selected ? "rgba(196,168,106,0.12)" : surface.card,
                  cursor: "pointer",
                  borderRadius: "var(--scout-radius)",
                }}
              >
                <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, display: "block" }}>
                  {opt.label}
                </span>
                <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>{opt.hint}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <ScoutPrimaryBtn
            onClick={submit}
            disabled={!file || uploading}
            style={{ flex: "1 1 140px", opacity: !file || uploading ? 0.55 : 1, justifyContent: "center" }}
          >
            {uploading ? "Uploading…" : "Upload"}
          </ScoutPrimaryBtn>
          <ScoutSecondaryBtn onClick={onClose} disabled={uploading} style={{ flex: "1 1 100px", justifyContent: "center" }}>
            Cancel
          </ScoutSecondaryBtn>
        </div>
      </div>
    </div>,
    document.body,
  );
}

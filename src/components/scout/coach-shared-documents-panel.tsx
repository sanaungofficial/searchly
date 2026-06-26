"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserAssetType } from "@/lib/asset-types";
import { ASSET_TYPE_ACCEPT, ASSET_TYPE_LABELS } from "@/lib/asset-types";
import type { CoachSharedDocumentView } from "@/lib/coach-shared-documents";
import { ScoutBox, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontMono, fontSans, surface, type as T } from "@/lib/typography";

const SHARE_TYPES: UserAssetType[] = ["JOB_SEARCH_STRATEGY", "COVER_LETTER", "RESUME", "OTHER"];

type AssignedCoachOption = {
  coachProfileId: string;
  displayName: string;
};

type Props = {
  clientUserId: string;
  mode: "coach" | "admin";
  assignedCoaches?: AssignedCoachOption[];
  compact?: boolean;
};

export function CoachSharedDocumentsPanel({
  clientUserId,
  mode,
  assignedCoaches = [],
  compact = false,
}: Props) {
  const [documents, setDocuments] = useState<CoachSharedDocumentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<UserAssetType>("JOB_SEARCH_STRATEGY");
  const [notes, setNotes] = useState("");
  const [coachProfileId, setCoachProfileId] = useState(assignedCoaches[0]?.coachProfileId ?? "");
  const [coachPickerOptions, setCoachPickerOptions] = useState<AssignedCoachOption[]>(assignedCoaches);

  const listUrl =
    mode === "coach"
      ? `/api/coach/clients/${clientUserId}/shared-documents`
      : `/api/admin/clients/${clientUserId}/coach-documents`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(listUrl);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not load documents");
      setDocuments(data.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load documents");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl]);

  const coachOptions = coachPickerOptions.length > 0 ? coachPickerOptions : assignedCoaches;

  useEffect(() => {
    if (mode !== "admin") return;
    fetch("/api/admin/coaches")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const opts = list
          .filter((c: { status?: string }) => c.status === "ACTIVE" || !c.status)
          .map((c: { id: string; displayName: string }) => ({
            coachProfileId: c.id,
            displayName: c.displayName,
          }));
        setCoachPickerOptions(opts);
        if (opts.length && !coachProfileId) setCoachProfileId(opts[0].coachProfileId);
      })
      .catch(() => {
        if (assignedCoaches.length) setCoachPickerOptions(assignedCoaches);
      });
  }, [mode, assignedCoaches, coachProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    if (mode === "admin" && !coachProfileId) {
      setError("Select which coach is sharing this document.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      if (notes.trim()) form.append("notes", notes.trim());
      if (mode === "admin") form.append("coachProfileId", coachProfileId);

      const postUrl =
        mode === "coach"
          ? `/api/coach/clients/${clientUserId}/shared-documents`
          : `/api/admin/clients/${clientUserId}/coach-documents`;

      const res = await fetch(postUrl, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
      setNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (docId: string) => {
    setError(null);
    const deleteUrl =
      mode === "coach"
        ? `/api/coach/clients/${clientUserId}/shared-documents/${docId}`
        : `/api/admin/clients/${clientUserId}/coach-documents/${docId}`;
    const res = await fetch(deleteUrl, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not remove document");
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const accept = ASSET_TYPE_ACCEPT[type] ?? ".pdf,.doc,.docx,.txt";

  return (
    <ScoutBox padding={compact ? 16 : 20} style={{ marginTop: compact ? 0 : 20 }}>
      <p style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 12px" }}>
        Shared documents
      </p>
      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
        Upload files for your client — career strategy, prep materials, and more. They&apos;ll see these under Coaching → My coaches.
      </p>

      {mode === "admin" && coachOptions.length > 0 && (
        <label style={{ display: "block", marginBottom: 12, fontFamily: fontSans, fontSize: 13 }}>
          Sharing as coach
          <select
            value={coachProfileId}
            onChange={(e) => setCoachProfileId(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              border: border.line,
              fontFamily: fontSans,
              fontSize: 13,
              background: surface.card,
            }}
          >
            {coachOptions.map((c) => (
              <option key={c.coachProfileId} value={c.coachProfileId}>{c.displayName}</option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
        <label style={{ fontFamily: fontSans, fontSize: 13, flex: "1 1 140px" }}>
          Category
          <select
            value={type}
            onChange={(e) => setType(e.target.value as UserAssetType)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              border: border.line,
              fontFamily: fontSans,
              fontSize: 13,
              background: surface.card,
            }}
          >
            {SHARE_TYPES.map((t) => (
              <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label style={{ fontFamily: fontSans, fontSize: 13, flex: "2 1 200px" }}>
          Note (optional)
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Updated strategy for Q3"
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              border: border.line,
              fontFamily: fontSans,
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </label>
        <label style={{ fontFamily: fontSans, fontSize: 13 }}>
          <span style={{ display: "block", marginBottom: 6 }}>Upload file</span>
          <input
            type="file"
            accept={accept}
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
            style={{ fontSize: 13 }}
          />
        </label>
      </div>

      {uploading && (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 12px" }}>Uploading…</p>
      )}
      {error && (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b45309", margin: "0 0 12px" }}>{error}</p>
      )}

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>Loading documents…</p>
      ) : documents.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>No documents shared yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                border: border.line,
                background: surface.inset,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: color.ink }}>
                  {doc.name}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 4px" }}>
                  {doc.typeLabel}
                  {mode === "admin" && ` · ${doc.coachName}`}
                  {" · Shared "}
                  {new Date(doc.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  {doc.uploadedByName ? ` by ${doc.uploadedByName}` : ""}
                </p>
                {doc.notes && (
                  <p style={{ fontFamily: fontSans, fontSize: 12, color: color.stone, margin: 0, fontStyle: "italic" }}>
                    {doc.notes}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontFamily: fontSans,
                    fontSize: 12,
                    fontWeight: 600,
                    color: color.forest,
                    textDecoration: "none",
                    padding: "6px 10px",
                    border: border.line,
                    background: surface.card,
                  }}
                >
                  Open
                </a>
                <ScoutSecondaryBtn onClick={() => remove(doc.id)} style={{ minHeight: 32, fontSize: 12, padding: "6px 10px" }}>
                  Remove
                </ScoutSecondaryBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && documents.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <ScoutSecondaryBtn onClick={() => load()} style={{ minHeight: 36, fontSize: 12 }}>
            Refresh list
          </ScoutSecondaryBtn>
        </div>
      )}
    </ScoutBox>
  );
}

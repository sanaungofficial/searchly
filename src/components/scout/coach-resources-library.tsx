"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Lock, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachSharedDocumentView } from "@/lib/coach-shared-documents";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { ASSET_TYPE_ACCEPT, ASSET_TYPE_LABELS, type UserAssetType } from "@/lib/asset-types";
import { border, color, fontMono, fontSans } from "@/lib/typography";

const SHARE_TYPES: UserAssetType[] = ["JOB_SEARCH_STRATEGY", "COVER_LETTER", "RESUME", "OTHER"];

export function CoachResourcesLibrary() {
  const [resources, setResources] = useState<CoachSharedDocumentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [type, setType] = useState<UserAssetType>("OTHER");
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/resources");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load resources");
      setResources(data.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      form.append("name", title.trim() || file.name.replace(/\.[^/.]+$/, "") || file.name);
      form.append("isPublic", String(isPublic));
      const res = await fetch("/api/coach/resources", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function togglePublic(docId: string, next: boolean) {
    setError(null);
    try {
      const res = await fetch(`/api/coach/resources/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Update failed");
      }
      setResources((prev) =>
        prev.map((r) => (r.id === docId ? { ...r, isPublic: next, clientUserId: next ? null : r.clientUserId } : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this resource? Clients will lose access.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/coach/resources/${docId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Delete failed");
      }
      setResources((prev) => prev.filter((r) => r.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const accept = ASSET_TYPE_ACCEPT[type] ?? ".pdf,.doc,.docx,.txt";

  return (
    <ScoutBox padding={20}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 6px" }}>
          Resource library
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0, lineHeight: 1.55 }}>
          All files you&apos;ve uploaded — toggle public to show on your profile, or keep private for assigned clients only.
        </p>
      </div>

      <form
        onSubmit={handleUpload}
        style={{
          marginBottom: 20,
          padding: 16,
          borderRadius: "var(--scout-radius)",
          border: "var(--scout-border)",
          background: "rgba(26,58,47,0.03)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
          <label style={{ display: "flex", cursor: "pointer", alignItems: "center", gap: 8, fontFamily: fontSans, fontSize: 13, color: color.stone }}>
            <input type="radio" name="visibility" checked={isPublic} onChange={() => setIsPublic(true)} />
            <Globe style={{ width: 14, height: 14 }} />
            Public on profile
          </label>
          <label style={{ display: "flex", cursor: "pointer", alignItems: "center", gap: 8, fontFamily: fontSans, fontSize: 13, color: color.stone }}>
            <input type="radio" name="visibility" checked={!isPublic} onChange={() => setIsPublic(false)} />
            <Lock style={{ width: 14, height: 14 }} />
            Private (library / share to clients later)
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <label style={{ fontFamily: fontSans, fontSize: 13 }}>
            Title (optional)
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Interview prep guide"
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "8px 10px",
                border: "var(--scout-border)",
                fontFamily: fontSans,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            />
          </label>
          <label style={{ fontFamily: fontSans, fontSize: 13 }}>
            Category
            <select
              value={type}
              onChange={(e) => setType(e.target.value as UserAssetType)}
              style={{
                display: "block",
                width: "100%",
                marginTop: 6,
                padding: "8px 10px",
                border: "var(--scout-border)",
                fontFamily: fontSans,
                fontSize: 13,
                boxSizing: "border-box",
              }}
            >
              {SHARE_TYPES.map((t) => (
                <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </label>
        </div>
        <input ref={fileRef} type="file" accept={accept} style={{ display: "block", width: "100%", marginBottom: 12, fontSize: 13 }} />
        <ScoutPrimaryBtn type="submit" disabled={uploading} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Upload style={{ width: 16, height: 16 }} />
          {uploading ? "Uploading…" : "Add resource"}
        </ScoutPrimaryBtn>
      </form>

      {error ? <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b45309", margin: "0 0 12px" }}>{error}</p> : null}

      {loading ? (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>Loading…</p>
      ) : resources.length === 0 ? (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>No resources yet. Upload guides, templates, or recordings.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {resources.map((r) => (
            <li
              key={r.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 0",
                borderBottom: "var(--scout-border)",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: color.ink }}>{r.name}</p>
                <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>
                  {r.typeLabel}
                  {r.clientName ? ` · Shared with ${r.clientName}` : ""}
                  {" · "}
                  {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontFamily: fontSans,
                    fontSize: 12,
                    fontWeight: 600,
                    color: color.forest,
                    textDecoration: "none",
                    padding: "6px 10px",
                    border: "var(--scout-border)",
                  }}
                >
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => void togglePublic(r.id, !r.isPublic)}
                  className={cn(
                    r.isPublic ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-stone-100 text-stone-600 ring-stone-200",
                  )}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontFamily: fontSans,
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "inset 0 0 0 1px",
                  }}
                >
                  {r.isPublic ? <Globe style={{ width: 12, height: 12 }} /> : <Lock style={{ width: 12, height: 12 }} />}
                  {r.isPublic ? "Public" : "Private"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(r.id)}
                  aria-label="Delete"
                  style={{ background: "none", border: "none", cursor: "pointer", color: color.muted, padding: 6 }}
                >
                  <Trash2 style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "var(--scout-border)" }}>
        <ScoutSecondaryBtn type="button" onClick={() => void load()}>
          Refresh
        </ScoutSecondaryBtn>
      </div>
    </ScoutBox>
  );
}

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  linkedInChecklist,
  linkedInEditUrl,
  type LinkedInProfileDraft,
} from "@/lib/linkedin-profile";
import { LinkedInGenerateLoader } from "./linkedin-generate-loader";
import { ScoutBox, ScoutDisplayTitle, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { border, color, fontSans, surface } from "@/lib/typography";

const LI = {
  bg: "#f3f2ef",
  card: "#ffffff",
  blue: "#0a66c2",
  blueHover: "#004182",
  text: "rgba(0,0,0,0.9)",
  muted: "rgba(0,0,0,0.6)",
  border: "rgba(0,0,0,0.08)",
  banner: "linear-gradient(135deg, #dce6f0 0%, #c5d4e3 100%)",
};

type Props = {
  isMobile?: boolean;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type PhotoType = "profile" | "cover";

function PhotoEditOverlay({
  label,
  uploading,
  hasPhoto,
  visible,
  onUploadClick,
  onRemoveClick,
  shape = "rect",
}: {
  label: string;
  uploading: boolean;
  hasPhoto: boolean;
  visible: boolean;
  onUploadClick: () => void;
  onRemoveClick: () => void;
  shape?: "rect" | "circle";
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: "rgba(0,0,0,0.45)",
        opacity: visible || uploading ? 1 : 0,
        transition: "opacity 0.15s ease",
        borderRadius: shape === "circle" ? "50%" : 0,
        cursor: uploading ? "wait" : "pointer",
        pointerEvents: visible || uploading ? "auto" : "none",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!uploading) onUploadClick();
      }}
    >
      <span
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
          textAlign: "center",
          padding: "0 8px",
        }}
      >
        {uploading ? "Uploading…" : hasPhoto ? `Change ${label}` : `Upload ${label}`}
      </span>
      {hasPhoto && !uploading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveClick();
          }}
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 11,
            fontWeight: 600,
            color: "#fff",
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.5)",
            borderRadius: 4,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
}

export function ProfileLinkedInEditor({ isMobile = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<LinkedInProfileDraft | null>(null);
  const [name, setName] = useState("Your Name");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<PhotoType | null>(null);
  const [photoHover, setPhotoHover] = useState<PhotoType | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/linkedin-draft");
      const text = await res.text();
      let data: Record<string, unknown> = {};
      if (text) {
        try {
          data = JSON.parse(text) as Record<string, unknown>;
        } catch {
          throw new Error("Invalid server response");
        }
      }
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load");
      setDraft((data.draft as LinkedInProfileDraft | null) ?? null);
      setName(typeof data.name === "string" ? data.name : "Your Name");
      setAvatarUrl(typeof data.avatarUrl === "string" ? data.avatarUrl : null);
      setLinkedinUrl(typeof data.linkedinUrl === "string" ? data.linkedinUrl : null);
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/linkedin-draft/generate", { method: "POST" });
      const text = await res.text();
      let data: Record<string, unknown> = {};
      if (text) {
        try {
          data = JSON.parse(text) as Record<string, unknown>;
        } catch {
          throw new Error("Invalid server response");
        }
      }
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Generation failed");
      setDraft(data.draft as LinkedInProfileDraft);
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString());
      setSaveHint(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async (next: LinkedInProfileDraft) => {
    setDraft(next);
    setSaving(true);
    setSaveHint(null);
    try {
      const res = await fetch("/api/profile/linkedin-draft", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: next }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setUpdatedAt(new Date().toISOString());
      setSaveHint("Saved");
      setTimeout(() => setSaveHint(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (id: string, text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handlePhotoUpload = async (file: File, type: PhotoType) => {
    if (!draft) return;
    setUploadingPhoto(type);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      const res = await fetch("/api/profile/linkedin-draft/photo", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
      const next: LinkedInProfileDraft = {
        ...draft,
        ...(type === "profile" ? { profilePhotoUrl: data.url } : { coverPhotoUrl: data.url }),
      };
      if (type === "profile") setAvatarUrl(data.url);
      await saveDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingPhoto(null);
    }
  };

  const handlePhotoRemove = async (type: PhotoType) => {
    if (!draft) return;
    const next: LinkedInProfileDraft = {
      ...draft,
      ...(type === "profile" ? { profilePhotoUrl: null } : { coverPhotoUrl: null }),
    };
    await saveDraft(next);
  };

  const onPhotoFileChange = (type: PhotoType) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handlePhotoUpload(file, type);
    e.target.value = "";
  };

  if (loading) {
    return (
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", padding: "24px 0" }}>
        Loading LinkedIn preview…
      </p>
    );
  }

  const checklist = draft ? linkedInChecklist(draft) : [];
  const liUrl = linkedInEditUrl(linkedinUrl);
  const profilePhotoUrl = draft?.profilePhotoUrl ?? avatarUrl;
  const coverPhotoUrl = draft?.coverPhotoUrl ?? null;

  return (
    <div style={{ paddingBottom: 48 }}>
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={onPhotoFileChange("cover")}
      />
      <input
        ref={profileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={onPhotoFileChange("profile")}
      />
      <LinkedInGenerateLoader active={generating} />
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <ScoutDisplayTitle size={isMobile ? 22 : 26}>LinkedIn profile preview</ScoutDisplayTitle>
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "6px 0 0" }}>
            Your target LinkedIn — edit here, then copy each section into LinkedIn.
            {updatedAt && (
              <span> Last saved {new Date(updatedAt).toLocaleDateString()}.</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {saveHint && (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#1A3A2F", alignSelf: "center" }}>
              {saveHint}
            </span>
          )}
          {saving && (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: LI.muted, alignSelf: "center" }}>
              Saving…
            </span>
          )}
          <ScoutPrimaryBtn onClick={() => void generate()} disabled={generating} style={{ padding: "10px 18px" }}>
            {generating ? "Generating…" : draft ? "Regenerate from resume" : "Generate from resume"}
          </ScoutPrimaryBtn>
          <a
            href={liUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: fontSans,
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 18px",
              borderRadius: 0,
              border: border.lineStrong,
              background: surface.card,
              color: color.forest,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Open LinkedIn →
          </a>
        </div>
      </div>

      {error && (
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#C05050", marginBottom: 16 }}>{error}</p>
      )}

      {!draft && !generating && (
        <ScoutBox padding={isMobile ? 24 : 40} style={{ textAlign: "center" }}>
          <p style={{ fontFamily: fontSans, fontSize: 15, color: color.ink, marginBottom: 8 }}>
            No LinkedIn preview yet
          </p>
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, marginBottom: 20, maxWidth: 420, margin: "0 auto 20px" }}>
            Kimchi will transform your resume into a LinkedIn-style profile with paragraphs, headline, and skills — frozen until you regenerate.
          </p>
          <ScoutPrimaryBtn onClick={() => void generate()} style={{ padding: "12px 24px", fontSize: 14 }}>
            Generate LinkedIn preview
          </ScoutPrimaryBtn>
        </ScoutBox>
      )}

      {draft && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* LinkedIn mock */}
          <div
            style={{
              background: LI.bg,
              borderRadius: 0,
              padding: isMobile ? 12 : 16,
              border: `1px solid ${LI.border}`,
            }}
          >
            <div style={{ background: LI.card, borderRadius: 0, overflow: "hidden", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <div
                style={{
                  position: "relative",
                  height: isMobile ? 80 : 120,
                  background: coverPhotoUrl ? `url(${coverPhotoUrl}) center/cover no-repeat` : LI.banner,
                }}
                onMouseEnter={() => setPhotoHover("cover")}
                onMouseLeave={() => setPhotoHover(null)}
              >
                <PhotoEditOverlay
                  label="cover photo"
                  uploading={uploadingPhoto === "cover"}
                  hasPhoto={Boolean(coverPhotoUrl)}
                  visible={photoHover === "cover" || isMobile}
                  onUploadClick={() => coverInputRef.current?.click()}
                  onRemoveClick={() => void handlePhotoRemove("cover")}
                />
              </div>
              <div style={{ padding: isMobile ? "0 16px 20px" : "0 24px 28px", marginTop: isMobile ? -36 : -48 }}>
                <div
                  style={{
                    position: "relative",
                    width: isMobile ? 72 : 96,
                    height: isMobile ? 72 : 96,
                    borderRadius: "50%",
                    border: "4px solid white",
                    background: profilePhotoUrl ? `url(${profilePhotoUrl}) center/cover no-repeat` : "#c4c4c4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-ui)",
                    fontSize: 28,
                    fontWeight: 600,
                    color: "#fff",
                    overflow: "hidden",
                  }}
                  onMouseEnter={() => setPhotoHover("profile")}
                  onMouseLeave={() => setPhotoHover(null)}
                >
                  {!profilePhotoUrl && initials(name)}
                  <PhotoEditOverlay
                    label="profile photo"
                    uploading={uploadingPhoto === "profile"}
                    hasPhoto={Boolean(profilePhotoUrl)}
                    visible={photoHover === "profile" || isMobile}
                    shape="circle"
                    onUploadClick={() => profileInputRef.current?.click()}
                    onRemoveClick={() => void handlePhotoRemove("profile")}
                  />
                </div>
                <h3
                  style={{
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSize: isMobile ? 20 : 24,
                    fontWeight: 600,
                    color: LI.text,
                    margin: "12px 0 4px",
                  }}
                >
                  {name}
                </h3>
                <label style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: 11, color: LI.muted, marginBottom: 4 }}>
                  Headline ({draft.headline.length}/120)
                </label>
                <textarea
                  value={draft.headline}
                  onChange={(e) => setDraft({ ...draft, headline: e.target.value.slice(0, 120) })}
                  onBlur={() => void saveDraft(draft)}
                  rows={2}
                  style={{
                    width: "100%",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 14,
                    color: LI.text,
                    border: `1px solid ${LI.border}`,
                    borderRadius: 4,
                    padding: 8,
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: LI.muted, margin: "8px 0 0" }}>
                  {draft.experience[0]?.company || "Company"} · {draft.experience[0]?.location || "Location"}
                </p>
              </div>
            </div>

            {/* About */}
            <div style={{ background: LI.card, borderRadius: 0, marginTop: 8, padding: isMobile ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <h4 style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: LI.text }}>About</h4>
              <textarea
                value={draft.about}
                onChange={(e) => setDraft({ ...draft, about: e.target.value.slice(0, 2600) })}
                onBlur={() => void saveDraft(draft)}
                rows={8}
                style={{
                  width: "100%",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: LI.text,
                  border: `1px solid ${LI.border}`,
                  borderRadius: 4,
                  padding: 10,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Experience */}
            <div style={{ background: LI.card, borderRadius: 0, marginTop: 8, padding: isMobile ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <h4 style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 600, margin: "0 0 16px", color: LI.text }}>Experience</h4>
              {draft.experience.map((exp, idx) => (
                <div key={exp.id} style={{ marginBottom: idx < draft.experience.length - 1 ? 24 : 0, paddingBottom: idx < draft.experience.length - 1 ? 24 : 0, borderBottom: idx < draft.experience.length - 1 ? `1px solid ${LI.border}` : undefined }}>
                  <input
                    value={exp.title}
                    onChange={(e) => {
                      const experience = draft.experience.map((row) => (row.id === exp.id ? { ...row, title: e.target.value } : row));
                      setDraft({ ...draft, experience });
                    }}
                    onBlur={() => void saveDraft(draft)}
                    style={{ width: "100%", fontFamily: "system-ui", fontSize: 16, fontWeight: 600, border: "none", padding: 0, marginBottom: 4, color: LI.text }}
                  />
                  <input
                    value={exp.company}
                    onChange={(e) => {
                      const experience = draft.experience.map((row) => (row.id === exp.id ? { ...row, company: e.target.value } : row));
                      setDraft({ ...draft, experience });
                    }}
                    onBlur={() => void saveDraft(draft)}
                    style={{ width: "100%", fontFamily: "system-ui", fontSize: 14, border: "none", padding: 0, marginBottom: 4, color: LI.muted }}
                  />
                  <p style={{ fontFamily: "system-ui", fontSize: 13, color: LI.muted, margin: "0 0 10px" }}>
                    {[exp.from, exp.to].filter(Boolean).join(" – ")}{exp.location ? ` · ${exp.location}` : ""}
                  </p>
                  <textarea
                    value={exp.description}
                    onChange={(e) => {
                      const experience = draft.experience.map((row) => (row.id === exp.id ? { ...row, description: e.target.value } : row));
                      setDraft({ ...draft, experience });
                    }}
                    onBlur={() => void saveDraft(draft)}
                    rows={5}
                    placeholder="Describe your impact in paragraphs…"
                    style={{
                      width: "100%",
                      fontFamily: "system-ui, sans-serif",
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: LI.text,
                      border: `1px solid ${LI.border}`,
                      borderRadius: 4,
                      padding: 10,
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Skills */}
            {draft.skills.length > 0 && (
              <div style={{ background: LI.card, borderRadius: 0, marginTop: 8, padding: isMobile ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
                <h4 style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 600, margin: "0 0 12px", color: LI.text }}>Skills</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {draft.skills.map((skill) => (
                    <span
                      key={skill}
                      style={{
                        fontFamily: "system-ui",
                        fontSize: 14,
                        fontWeight: 600,
                        color: LI.muted,
                        background: "#eef3f8",
                        padding: "6px 14px",
                        borderRadius: 16,
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Checklist */}
          <ScoutBox
            padding={isMobile ? 16 : 20}
            style={{
              position: isMobile ? undefined : "sticky",
              top: 16,
            }}
          >
            <h4 style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: color.ink }}>
              What to update on LinkedIn
            </h4>
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 16px" }}>
              Copy each block, paste into LinkedIn. Your preview stays here until you regenerate.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {checklist.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: border.line,
                    borderRadius: 0,
                    padding: 12,
                    background: surface.inset,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div>
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, fontWeight: 600, color: LI.blue, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {item.section}
                      </span>
                      <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, margin: "2px 0 0", color: LI.text }}>
                        {item.label}
                      </p>
                      <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: LI.muted, margin: "2px 0 0" }}>
                        {item.linkedInHint}
                      </p>
                    </div>
                    <ScoutSecondaryBtn
                      type="button"
                      onClick={() => void handleCopy(item.id, item.copyText)}
                      active={copiedId === item.id}
                      style={{
                        flexShrink: 0,
                        fontSize: 12,
                        padding: "6px 12px",
                        background: copiedId === item.id ? "rgba(26,58,47,0.08)" : surface.card,
                        color: copiedId === item.id ? "#1A3A2F" : color.forest,
                      }}
                    >
                      {copiedId === item.id ? "Copied" : item.imageUrl ? "Copy URL" : "Copy"}
                    </ScoutSecondaryBtn>
                  </div>
                  {item.imageUrl ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <img
                        src={item.imageUrl}
                        alt={item.label}
                        style={{
                          width: item.id === "cover_photo" ? 72 : 48,
                          height: item.id === "cover_photo" ? 40 : 48,
                          objectFit: "cover",
                          borderRadius: item.id === "profile_photo" ? "50%" : 4,
                          border: `1px solid ${LI.border}`,
                          flexShrink: 0,
                        }}
                      />
                      <a
                        href={item.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontFamily: "var(--font-ui)",
                          fontSize: 12,
                          fontWeight: 600,
                          color: LI.blue,
                          textDecoration: "none",
                        }}
                      >
                        Open image →
                      </a>
                    </div>
                  ) : (
                    <p
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        color: LI.muted,
                        margin: 0,
                        lineHeight: 1.45,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.copyText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScoutBox>
        </div>
      )}
    </div>
  );
}

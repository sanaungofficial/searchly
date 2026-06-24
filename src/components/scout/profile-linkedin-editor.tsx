"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  linkedInChecklist,
  linkedInEditUrl,
  type LinkedInProfileDraft,
} from "@/lib/linkedin-profile";

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setDraft(data.draft);
      setUpdatedAt(data.updatedAt ?? new Date().toISOString());
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

  if (loading) {
    return (
      <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", padding: "24px 0" }}>
        Loading LinkedIn preview…
      </p>
    );
  }

  const checklist = draft ? linkedInChecklist(draft) : [];
  const liUrl = linkedInEditUrl(linkedinUrl);

  return (
    <div style={{ paddingBottom: 48 }}>
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
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: isMobile ? 22 : 26,
              fontWeight: 500,
              fontStyle: "italic",
              color: "#1A1A1A",
              margin: 0,
            }}
          >
            LinkedIn profile preview
          </h2>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: LI.muted, margin: "6px 0 0" }}>
            Your target LinkedIn — edit here, then copy each section into LinkedIn.
            {updatedAt && (
              <span> Last saved {new Date(updatedAt).toLocaleDateString()}.</span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {saveHint && (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#4A8B6A", alignSelf: "center" }}>
              {saveHint}
            </span>
          )}
          {saving && (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: LI.muted, alignSelf: "center" }}>
              Saving…
            </span>
          )}
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 18px",
              borderRadius: 24,
              border: `1px solid ${LI.blue}`,
              background: generating ? "#e8f4fc" : LI.blue,
              color: generating ? LI.blue : "#fff",
              cursor: generating ? "wait" : "pointer",
            }}
          >
            {generating ? "Generating…" : draft ? "Regenerate from resume" : "Generate from resume"}
          </button>
          <a
            href={liUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 600,
              padding: "10px 18px",
              borderRadius: 24,
              border: `1px solid ${LI.border}`,
              background: LI.card,
              color: LI.blue,
              textDecoration: "none",
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
        <div
          style={{
            background: LI.card,
            borderRadius: 12,
            border: `1px solid ${LI.border}`,
            padding: isMobile ? 24 : 40,
            textAlign: "center",
          }}
        >
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, color: LI.text, marginBottom: 8 }}>
            No LinkedIn preview yet
          </p>
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: LI.muted, marginBottom: 20, maxWidth: 420, margin: "0 auto 20px" }}>
            Kimchi will transform your resume into a LinkedIn-style profile with paragraphs, headline, and skills — frozen until you regenerate.
          </p>
          <button
            type="button"
            onClick={() => void generate()}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: 600,
              padding: "12px 24px",
              borderRadius: 24,
              border: "none",
              background: LI.blue,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Generate LinkedIn preview
          </button>
        </div>
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
              borderRadius: 12,
              padding: isMobile ? 12 : 16,
              border: `1px solid ${LI.border}`,
            }}
          >
            <div style={{ background: LI.card, borderRadius: 8, overflow: "hidden", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <div style={{ height: isMobile ? 80 : 120, background: LI.banner }} />
              <div style={{ padding: isMobile ? "0 16px 20px" : "0 24px 28px", marginTop: isMobile ? -36 : -48 }}>
                <div
                  style={{
                    width: isMobile ? 72 : 96,
                    height: isMobile ? 72 : 96,
                    borderRadius: "50%",
                    border: "4px solid white",
                    background: avatarUrl ? `url(${avatarUrl}) center/cover` : "#c4c4c4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-ui)",
                    fontSize: 28,
                    fontWeight: 600,
                    color: "#fff",
                  }}
                >
                  {!avatarUrl && initials(name)}
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
            <div style={{ background: LI.card, borderRadius: 8, marginTop: 8, padding: isMobile ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
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
            <div style={{ background: LI.card, borderRadius: 8, marginTop: 8, padding: isMobile ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
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
              <div style={{ background: LI.card, borderRadius: 8, marginTop: 8, padding: isMobile ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
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
          <div
            style={{
              background: LI.card,
              borderRadius: 12,
              border: `1px solid ${LI.border}`,
              padding: isMobile ? 16 : 20,
              position: isMobile ? undefined : "sticky",
              top: 16,
            }}
          >
            <h4 style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: LI.text }}>
              What to update on LinkedIn
            </h4>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: LI.muted, margin: "0 0 16px" }}>
              Copy each block, paste into LinkedIn. Your preview stays here until you regenerate.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {checklist.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: `1px solid ${LI.border}`,
                    borderRadius: 8,
                    padding: 12,
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
                    <button
                      type="button"
                      onClick={() => void handleCopy(item.id, item.copyText)}
                      style={{
                        flexShrink: 0,
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "6px 12px",
                        borderRadius: 16,
                        border: `1px solid ${LI.border}`,
                        background: copiedId === item.id ? "#e8f5ee" : "#fff",
                        color: copiedId === item.id ? "#4A8B6A" : LI.blue,
                        cursor: "pointer",
                      }}
                    >
                      {copiedId === item.id ? "Copied" : "Copy"}
                    </button>
                  </div>
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
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

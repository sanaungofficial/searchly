"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  linkedInChecklist,
  linkedInEditUrl,
} from "@/lib/linkedin-profile";
import { useCompactLayout } from "@/hooks/use-compact-layout";
import { LinkedInGenerateLoader } from "./linkedin-generate-loader";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { ScoutBox, ScoutDisplayTitle, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { border, color, fontSans, surface } from "@/lib/typography";
import { JobrightScorePill } from "./profile-resume-jobright-document";
import { ResumeAnalysisReportDrawer, buildFullReport } from "./profile-resume-analysis-report";
import { ResumeSectionFixDrawer, type SectionFixIssue } from "./profile-resume-section-fix-drawer";
import {
  linkedInAnalysisToReport,
  linkedInExperienceEntryScores,
  findPriorityLinkedInSection,
  LINKEDIN_SECTION_TITLES,
  type LinkedInAnalysisData,
  type LinkedInSectionId,
} from "@/lib/linkedin-analysis";
import { LINKEDIN_EMPLOYMENT_TYPES, newLinkedInEntryId, type LinkedInProfileDraft } from "@/lib/linkedin-profile";
import { ScoreExplainerPopover } from "./score-explainer-popover";
import { LinkedInOrgPicker } from "./linkedin-org-picker";
import { CompanyLogo } from "./company-logo";

const LI = {
  bg: "#f3f2ef",
  card: "#ffffff",
  blue: "#0a66c2",
  text: "rgba(0,0,0,0.9)",
  muted: "rgba(0,0,0,0.6)",
  border: "rgba(0,0,0,0.08)",
  banner: "linear-gradient(135deg, #dce6f0 0%, #c5d4e3 100%)",
};

type Props = {
  isMobile?: boolean;
};

type PhotoType = "profile" | "cover";

type FixSectionState = {
  sectionId: LinkedInSectionId;
  entryId?: string;
  entryLabel?: string;
} | null;

const liField: React.CSSProperties = {
  width: "100%",
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: LI.text,
  border: `1px solid transparent`,
  borderRadius: 4,
  padding: "4px 6px",
  margin: "0 -6px",
  background: "transparent",
  outline: "none",
  boxSizing: "border-box",
};

const liFieldFocus = {
  border: `1px solid ${LI.blue}`,
  background: "#fff",
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

function LiEntryMenu({
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <button type="button" disabled={!canMoveUp} onClick={onMoveUp} title="Move up" style={entryMenuBtnStyle(!canMoveUp)}>↑</button>
      <button type="button" disabled={!canMoveDown} onClick={onMoveDown} title="Move down" style={entryMenuBtnStyle(!canMoveDown)}>↓</button>
      <button type="button" onClick={onDelete} title="Remove" style={{ ...entryMenuBtnStyle(false), color: "#b24040" }}>×</button>
    </div>
  );
}

const entryMenuBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "2px 8px",
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 4,
  border: `1px solid ${LI.border}`,
  background: LI.card,
  color: disabled ? LI.muted : LI.text,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
});

function LiSectionActions({ onImprove }: { onImprove: () => void }) {
  return (
    <button
      type="button"
      onClick={onImprove}
      style={{
        padding: "4px 12px",
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 4,
        border: "none",
        background: LI.blue,
        color: "#fff",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      Improve
    </button>
  );
}

function LiSectionHeader({
  title,
  onImprove,
  onAdd,
  addLabel,
}: {
  title: string;
  onImprove: () => void;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
      <h4 style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 600, margin: 0, color: LI.text }}>{title}</h4>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              border: `1px solid ${LI.border}`,
              background: LI.card,
              color: LI.blue,
              cursor: "pointer",
            }}
          >
            {addLabel ?? "+ Add"}
          </button>
        )}
        <LiSectionActions onImprove={onImprove} />
      </div>
    </div>
  );
}

function reorderEntries<T extends { id: string }>(list: T[], id: string, direction: "up" | "down"): T[] {
  const idx = list.findIndex((row) => row.id === id);
  if (idx < 0) return list;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= list.length) return list;
  const next = [...list];
  [next[idx], next[swap]] = [next[swap], next[idx]];
  return next;
}

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
      <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 600, color: "#fff", textAlign: "center", padding: "0 8px" }}>
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
  const compact = useCompactLayout();
  const stackLayout = isMobile || compact;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<LinkedInProfileDraft | null>(null);
  const draftRef = useRef<LinkedInProfileDraft | null>(null);
  const [name, setName] = useState("Your Name");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<PhotoType | null>(null);
  const [photoHover, setPhotoHover] = useState<PhotoType | null>(null);
  const [analysis, setAnalysis] = useState<LinkedInAnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [fixSection, setFixSection] = useState<FixSectionState>(null);
  const [fixSuggestions, setFixSuggestions] = useState<{ id: string; label: string; text: string }[]>([]);
  const [fixSuggestIssues, setFixSuggestIssues] = useState<SectionFixIssue[]>([]);
  const [fixSuggestionsLoading, setFixSuggestionsLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [showImportInput, setShowImportInput] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const analysisDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  draftRef.current = draft;

  const patchDraft = useCallback((updater: (prev: LinkedInProfileDraft) => LinkedInProfileDraft) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      draftRef.current = next;
      return next;
    });
  }, []);

  const loadAnalysis = useCallback(async (force = false) => {
    if (!draftRef.current) return;
    setAnalysisLoading(true);
    try {
      const url = force ? "/api/profile/linkedin-draft/analysis?force=true" : "/api/profile/linkedin-draft/analysis";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setAnalysis(data);
      else setAnalysis({ error: data.error || "Analysis unavailable" });
    } catch {
      setAnalysis({ error: "Could not load analysis" });
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

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
      const loaded = (data.draft as LinkedInProfileDraft | null) ?? null;
      setDraft(loaded);
      draftRef.current = loaded;
      setName(typeof data.name === "string" ? data.name : "Your Name");
      setAvatarUrl(typeof data.avatarUrl === "string" ? data.avatarUrl : null);
      setLinkedinUrl(typeof data.linkedinUrl === "string" ? data.linkedinUrl : null);
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : null);
      if (loaded) void loadAnalysis();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [loadAnalysis]);

  useEffect(() => {
    void load();
    return () => {
      if (analysisDebounceRef.current) clearTimeout(analysisDebounceRef.current);
    };
  }, [load]);

  const scheduleAnalysisRefresh = useCallback(() => {
    if (analysisDebounceRef.current) clearTimeout(analysisDebounceRef.current);
    analysisDebounceRef.current = setTimeout(() => {
      void loadAnalysis(true);
    }, 2500);
  }, [loadAnalysis]);

  const saveDraft = async (next?: LinkedInProfileDraft, refreshAnalysis = true) => {
    const payload = next ?? draftRef.current;
    if (!payload) return;
    setDraft(payload);
    draftRef.current = payload;
    setSaving(true);
    setSaveHint(null);
    try {
      const res = await fetch("/api/profile/linkedin-draft", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: payload }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setUpdatedAt(new Date().toISOString());
      setSaveHint("Saved");
      setTimeout(() => setSaveHint(null), 2000);
      if (refreshAnalysis) scheduleAnalysisRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveCurrentDraft = () => {
    if (draftRef.current) void saveDraft(draftRef.current);
  };

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
      const next = data.draft as LinkedInProfileDraft;
      setDraft(next);
      draftRef.current = next;
      setUpdatedAt(typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString());
      setSaveHint(null);
      await loadAnalysis(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
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

  const importFromLinkedIn = async () => {
    const url = (importUrl.trim() || linkedinUrl?.trim()) ?? "";
    if (!url) {
      setError("Enter your LinkedIn profile URL to import.");
      setShowImportInput(true);
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/linkedin-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrl: url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Import failed");
      await load();
      if (typeof data.linkedinUrl === "string") setLinkedinUrl(data.linkedinUrl);
      if (typeof data.name === "string") setName(data.name);
      setUpdatedAt(new Date().toISOString());
      setShowImportInput(false);
      setImportUrl("");
      await loadAnalysis(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "LinkedIn import failed");
    } finally {
      setImporting(false);
    }
  };

  const openImprove = (
    sectionId: LinkedInSectionId,
    options?: { entryId?: string; entryLabel?: string },
  ) => {
    const entryId = options?.entryId;
    const entryLabel = options?.entryLabel;
    setFixSection({ sectionId, entryId, entryLabel });
    setFixSuggestions([]);
    setFixSuggestIssues([]);

    setFixSuggestionsLoading(true);
    void fetch("/api/profile/linkedin-draft/section-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, entryId, entryLabel }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          if (Array.isArray(data.suggestions)) setFixSuggestions(data.suggestions);
          if (Array.isArray(data.issues)) {
            setFixSuggestIssues(
              data.issues.map(
                (
                  row: {
                    id?: string;
                    severity?: string;
                    title?: string;
                    issueDetected?: string;
                    whyItMatters?: string;
                    howToImprove?: string;
                  },
                  i: number,
                ) => ({
                  id: row.id ?? `${sectionId}-s-${i}`,
                  severity:
                    row.severity === "Urgent" ||
                    row.severity === "Critical" ||
                    row.severity === "Optional" ||
                    row.severity === "Minor"
                      ? row.severity
                      : "Optional",
                  title: row.title ?? "Suggestion",
                  issueDetected: row.issueDetected ?? "",
                  whyItMatters: row.whyItMatters ?? "",
                  howToImprove: row.howToImprove ?? "",
                }),
              ),
            );
          }
        }
      })
      .catch(() => {})
      .finally(() => setFixSuggestionsLoading(false));
  };

  const applyFixSuggestion = (text: string) => {
    if (!fixSection) return;
    const { sectionId, entryId } = fixSection;
    patchDraft((d) => {
      if (sectionId === "headline") return { ...d, headline: text.slice(0, 120) };
      if (sectionId === "about") return { ...d, about: text };
      if (sectionId === "skills") {
        return {
          ...d,
          skills: text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 50),
        };
      }
      if (sectionId === "experience") {
        if (entryId) {
          return {
            ...d,
            experience: d.experience.map((exp) =>
              exp.id === entryId ? { ...exp, description: text } : exp,
            ),
          };
        }
        return {
          ...d,
          experience: d.experience.map((exp, i) => (i === 0 ? { ...exp, description: text } : exp)),
        };
      }
      if (sectionId === "education" && entryId) {
        return {
          ...d,
          education: d.education.map((edu) =>
            edu.id === entryId ? { ...edu, degree: text } : edu,
          ),
        };
      }
      return d;
    });
    void saveDraft(draftRef.current ?? undefined);
    setFixSection(null);
    setFixSuggestions([]);
  };

  const addExperience = () => {
    patchDraft((d) => ({
      ...d,
      experience: [
        ...d.experience,
        {
          id: newLinkedInEntryId("li_exp"),
          title: "",
          company: "",
          companyRef: null,
          employmentType: "Full-time",
          location: null,
          from: null,
          to: null,
          description: "",
        },
      ],
    }));
  };

  const addEducation = () => {
    patchDraft((d) => ({
      ...d,
      education: [
        ...d.education,
        {
          id: newLinkedInEntryId("li_edu"),
          school: "",
          schoolRef: null,
          degree: "",
          field: null,
          from: null,
          to: null,
        },
      ],
    }));
  };

  const fieldStyle = (id: string, extra?: React.CSSProperties): React.CSSProperties => ({
    ...liField,
    ...(focusedField === id ? liFieldFocus : {}),
    ...extra,
  });

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

  const analysisReport = linkedInAnalysisToReport(analysis, draft);
  const fullReport = buildFullReport({
    score: analysisReport.score,
    headline: analysisReport.headline,
    strengths: analysisReport.strengths,
    issues: analysisReport.issues,
    highlights: analysisReport.highlights,
    updatedAt: analysisReport.updatedAt,
  });
  const experienceScores = draft ? linkedInExperienceEntryScores(draft) : [];
  const scoreByEntryId = new Map(experienceScores.map((s) => [s.entryId, s]));

  const fixIssues: SectionFixIssue[] = fixSuggestIssues;

  return (
    <div style={{ paddingBottom: 48, minWidth: 0, width: "100%", position: "relative" }}>
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={onPhotoFileChange("cover")} />
      <input ref={profileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={onPhotoFileChange("profile")} />
      <LinkedInGenerateLoader active={generating} />
      {importing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 199,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(247,245,242,0.72)",
            backdropFilter: "blur(8px)",
          }}
        >
          <KimchiProcessLoader preset="linkedInImport" variant="card" />
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <ScoutDisplayTitle size={stackLayout ? 22 : 26}>LinkedIn profile preview</ScoutDisplayTitle>
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
            Pulled from your About profile — edit here for a LinkedIn-ready view, or refine in About as the source of truth. Changes sync back to About automatically.
            {updatedAt && <span> Last saved {new Date(updatedAt).toLocaleDateString()}.</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
          {draft && (
            <>
              <JobrightScorePill
                score={analysisReport.score}
                grade={analysisReport.grade}
                gradeLabel={analysisReport.gradeLabel}
                onViewReport={() => setReportOpen(true)}
              />
              <ScoreExplainerPopover variant="linkedin-quality" />
            </>
          )}
          {saveHint && <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#1A3A2F" }}>{saveHint}</span>}
          {saving && <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: LI.muted }}>Saving…</span>}
          <ScoutSecondaryBtn
            type="button"
            onClick={() => {
              setShowImportInput((v) => !v);
              if (!importUrl && linkedinUrl) setImportUrl(linkedinUrl);
            }}
            disabled={importing}
            style={{ padding: "10px 18px" }}
          >
            {importing ? "Importing…" : "Import from LinkedIn"}
          </ScoutSecondaryBtn>
          <ScoutPrimaryBtn onClick={() => void generate()} disabled={generating} style={{ padding: "10px 18px" }}>
            {generating ? "Refreshing…" : draft ? "Refresh from About" : "Build from About"}
          </ScoutPrimaryBtn>
          <a href={liUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: 0, border: border.lineStrong, background: surface.card, color: color.forest, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Open LinkedIn →
          </a>
        </div>
      </div>

      {error && <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#C05050", marginBottom: 16 }}>{error}</p>}

      {showImportInput && (
        <ScoutBox padding={16} style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://www.linkedin.com/in/your-handle"
            style={{
              flex: "1 1 240px",
              minWidth: 200,
              padding: "10px 12px",
              fontFamily: fontSans,
              fontSize: 14,
              border: border.line,
              background: surface.inset,
            }}
          />
          <ScoutPrimaryBtn type="button" onClick={() => void importFromLinkedIn()} disabled={importing}>
            {importing ? "Importing…" : "Run import"}
          </ScoutPrimaryBtn>
          <ScoutSecondaryBtn type="button" onClick={() => setShowImportInput(false)} disabled={importing}>
            Cancel
          </ScoutSecondaryBtn>
          <p style={{ flex: "1 1 100%", margin: 0, fontFamily: fontSans, fontSize: 12, color: color.muted }}>
            Pulls your live LinkedIn profile into this editor. Requires Apify on this environment (production).
          </p>
        </ScoutBox>
      )}

      {!draft && !generating && (
        <ScoutBox padding={stackLayout ? 24 : 40} style={{ textAlign: "center" }}>
          <p style={{ fontFamily: fontSans, fontSize: 15, color: color.ink, marginBottom: 8 }}>No LinkedIn preview yet</p>
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, marginBottom: 20, maxWidth: 420, margin: "0 auto 20px" }}>
            Add experience, education, and a summary in About — Kimchi builds a trimmed LinkedIn preview from that data.
          </p>
          <ScoutPrimaryBtn onClick={() => void generate()} style={{ padding: "12px 24px", fontSize: 14 }}>
            Build from About
          </ScoutPrimaryBtn>
        </ScoutBox>
      )}

      {draft && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: stackLayout ? "1fr" : "minmax(0, 1fr) minmax(260px, 320px)",
            gap: 20,
            alignItems: "start",
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0, background: LI.bg, borderRadius: 0, padding: stackLayout ? 12 : 16, border: `1px solid ${LI.border}` }}>
            <div style={{ background: LI.card, borderRadius: 0, overflow: "hidden", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <div
                style={{ position: "relative", height: stackLayout ? 80 : 120, background: coverPhotoUrl ? `url(${coverPhotoUrl}) center/cover no-repeat` : LI.banner }}
                onMouseEnter={() => setPhotoHover("cover")}
                onMouseLeave={() => setPhotoHover(null)}
              >
                <PhotoEditOverlay label="cover photo" uploading={uploadingPhoto === "cover"} hasPhoto={Boolean(coverPhotoUrl)} visible={photoHover === "cover" || stackLayout} onUploadClick={() => coverInputRef.current?.click()} onRemoveClick={() => void handlePhotoRemove("cover")} />
              </div>
              <div style={{ padding: stackLayout ? "0 16px 20px" : "0 24px 28px", marginTop: stackLayout ? -36 : -48 }}>
                <div
                  style={{ position: "relative", width: stackLayout ? 72 : 96, height: stackLayout ? 72 : 96, borderRadius: "50%", border: "4px solid white", background: profilePhotoUrl ? `url(${profilePhotoUrl}) center/cover no-repeat` : "#c4c4c4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, color: "#fff", overflow: "hidden" }}
                  onMouseEnter={() => setPhotoHover("profile")}
                  onMouseLeave={() => setPhotoHover(null)}
                >
                  {!profilePhotoUrl && initials(name)}
                  <PhotoEditOverlay label="profile photo" uploading={uploadingPhoto === "profile"} hasPhoto={Boolean(profilePhotoUrl)} visible={photoHover === "profile" || stackLayout} shape="circle" onUploadClick={() => profileInputRef.current?.click()} onRemoveClick={() => void handlePhotoRemove("profile")} />
                </div>
                <h3 style={{ fontFamily: "system-ui, sans-serif", fontSize: stackLayout ? 20 : 24, fontWeight: 600, color: LI.text, margin: "12px 0 4px" }}>{name}</h3>

                <LiSectionHeader title="Headline" onImprove={() => openImprove("headline")} />
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: LI.muted, margin: "0 0 6px" }}>{draft.headline.length}/120</p>
                <textarea
                  value={draft.headline}
                  onChange={(e) => patchDraft((d) => ({ ...d, headline: e.target.value.slice(0, 120) }))}
                  onFocus={() => setFocusedField("headline")}
                  onBlur={() => { setFocusedField(null); saveCurrentDraft(); }}
                  rows={2}
                  style={fieldStyle("headline", { fontSize: 14, lineHeight: 1.45, resize: "vertical" })}
                />
                <input
                  value={draft.location ?? ""}
                  onChange={(e) => patchDraft((d) => ({ ...d, location: e.target.value }))}
                  onFocus={() => setFocusedField("location")}
                  onBlur={() => { setFocusedField(null); saveCurrentDraft(); }}
                  placeholder="City, State/Region, Country"
                  style={fieldStyle("location", { fontSize: 13, color: LI.muted, marginTop: 8 })}
                />
              </div>
            </div>

            <div style={{ background: LI.card, borderRadius: 0, marginTop: 8, padding: stackLayout ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <LiSectionHeader title="About" onImprove={() => openImprove("about")} />
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: LI.muted, margin: "0 0 8px" }}>{draft.about.length}/2600</p>
              <textarea
                value={draft.about}
                onChange={(e) => patchDraft((d) => ({ ...d, about: e.target.value.slice(0, 2600) }))}
                onFocus={() => setFocusedField("about")}
                onBlur={() => { setFocusedField(null); saveCurrentDraft(); }}
                rows={8}
                style={fieldStyle("about", { fontSize: 14, lineHeight: 1.55, resize: "vertical" })}
              />
            </div>

            <div style={{ background: LI.card, borderRadius: 0, marginTop: 8, padding: stackLayout ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <LiSectionHeader
                title="Experience"
                addLabel="+ Add role"
                onAdd={() => { addExperience(); saveCurrentDraft(); }}
                onImprove={() => openImprove("experience")}
              />
              {draft.experience.length === 0 && (
                <p style={{ fontFamily: "system-ui", fontSize: 14, color: LI.muted, margin: "0 0 12px" }}>
                  No roles yet — add your work history to match your LinkedIn profile.
                </p>
              )}
              {draft.experience.map((exp, idx) => {
                const entryScore = scoreByEntryId.get(exp.id);
                return (
                <div
                  key={exp.id}
                  style={{
                    marginBottom: idx < draft.experience.length - 1 ? 24 : 0,
                    paddingBottom: idx < draft.experience.length - 1 ? 24 : 0,
                    borderBottom: idx < draft.experience.length - 1 ? `1px solid ${LI.border}` : undefined,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <CompanyLogo
                      name={exp.company || "Company"}
                      website={exp.companyRef?.website}
                      logoUrl={exp.companyRef?.logoUrl}
                      size={48}
                      borderRadius={0}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                        <input
                          value={exp.title}
                          onChange={(e) =>
                            patchDraft((d) => ({
                              ...d,
                              experience: d.experience.map((row) =>
                                row.id === exp.id ? { ...row, title: e.target.value } : row,
                              ),
                            }))
                          }
                          onFocus={() => setFocusedField(`${exp.id}-title`)}
                          onBlur={() => { setFocusedField(null); saveCurrentDraft(); }}
                          placeholder="Job title"
                          style={fieldStyle(`${exp.id}-title`, { fontSize: 16, fontWeight: 600, flex: 1 })}
                        />
                        {entryScore && entryScore.score < 80 && (
                          <span
                            title={entryScore.issues.join(" · ")}
                            style={{
                              flexShrink: 0,
                              fontFamily: "system-ui",
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "3px 8px",
                              background: entryScore.score < 60 ? "#fde8e8" : "#fef3c7",
                              color: entryScore.score < 60 ? "#b24040" : "#92400e",
                            }}
                          >
                            {entryScore.grade}
                          </span>
                        )}
                        </div>
                        <LiEntryMenu
                          canMoveUp={idx > 0}
                          canMoveDown={idx < draft.experience.length - 1}
                          onMoveUp={() => {
                            patchDraft((d) => ({ ...d, experience: reorderEntries(d.experience, exp.id, "up") }));
                            saveCurrentDraft();
                          }}
                          onMoveDown={() => {
                            patchDraft((d) => ({ ...d, experience: reorderEntries(d.experience, exp.id, "down") }));
                            saveCurrentDraft();
                          }}
                          onDelete={() => {
                            patchDraft((d) => ({ ...d, experience: d.experience.filter((row) => row.id !== exp.id) }));
                            saveCurrentDraft();
                          }}
                        />
                      </div>
                      <LinkedInOrgPicker
                        value={exp.company}
                        orgRef={exp.companyRef}
                        placeholder="Company name"
                        hintLabel="company"
                        showLogo={false}
                        onChange={(name, ref) =>
                          patchDraft((d) => ({
                            ...d,
                            experience: d.experience.map((row) =>
                              row.id === exp.id ? { ...row, company: name, companyRef: ref } : row,
                            ),
                          }))
                        }
                        onFocus={() => setFocusedField(`${exp.id}-company`)}
                        onBlur={() => { setFocusedField(null); saveCurrentDraft(); }}
                        inputStyle={fieldStyle(`${exp.id}-company`, { fontSize: 14, color: LI.muted })}
                      />
                      <select
                        value={exp.employmentType ?? ""}
                        onChange={(e) =>
                          patchDraft((d) => ({
                            ...d,
                            experience: d.experience.map((row) =>
                              row.id === exp.id ? { ...row, employmentType: e.target.value || null } : row,
                            ),
                          }))
                        }
                        onBlur={saveCurrentDraft}
                        style={{
                          ...fieldStyle(`${exp.id}-type`, { fontSize: 13, color: LI.muted, marginTop: 6, maxWidth: 200 }),
                          cursor: "pointer",
                        }}
                      >
                        <option value="">Employment type</option>
                        {LINKEDIN_EMPLOYMENT_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 10 }}>
                        <input
                          value={exp.from ?? ""}
                          onChange={(e) =>
                            patchDraft((d) => ({
                              ...d,
                              experience: d.experience.map((row) =>
                                row.id === exp.id ? { ...row, from: e.target.value } : row,
                              ),
                            }))
                          }
                          onFocus={() => setFocusedField(`${exp.id}-from`)}
                          onBlur={() => { setFocusedField(null); saveCurrentDraft(); }}
                          placeholder="Start month/year"
                          style={fieldStyle(`${exp.id}-from`, { fontSize: 13, color: LI.muted, width: stackLayout ? "100%" : 110, flex: stackLayout ? "1 1 100%" : undefined })}
                        />
                        <span style={{ color: LI.muted, alignSelf: "center" }}>–</span>
                        <input
                          value={exp.to ?? ""}
                          onChange={(e) =>
                            patchDraft((d) => ({
                              ...d,
                              experience: d.experience.map((row) =>
                                row.id === exp.id ? { ...row, to: e.target.value } : row,
                              ),
                            }))
                          }
                          onFocus={() => setFocusedField(`${exp.id}-to`)}
                          onBlur={() => { setFocusedField(null); saveCurrentDraft(); }}
                          placeholder="End or Present"
                          style={fieldStyle(`${exp.id}-to`, { fontSize: 13, color: LI.muted, width: stackLayout ? "100%" : 120, flex: stackLayout ? "1 1 100%" : undefined })}
                        />
                        <input
                          value={exp.location ?? ""}
                          onChange={(e) =>
                            patchDraft((d) => ({
                              ...d,
                              experience: d.experience.map((row) =>
                                row.id === exp.id ? { ...row, location: e.target.value } : row,
                              ),
                            }))
                          }
                          onFocus={() => setFocusedField(`${exp.id}-loc`)}
                          onBlur={() => { setFocusedField(null); saveCurrentDraft(); }}
                          placeholder="Location"
                          style={fieldStyle(`${exp.id}-loc`, { fontSize: 13, color: LI.muted, flex: "1 1 140px", minWidth: 120 })}
                        />
                      </div>
                      <textarea
                        value={exp.description}
                        onChange={(e) =>
                          patchDraft((d) => ({
                            ...d,
                            experience: d.experience.map((row) =>
                              row.id === exp.id ? { ...row, description: e.target.value } : row,
                            ),
                          }))
                        }
                        onFocus={() => setFocusedField(`${exp.id}-desc`)}
                        onBlur={() => { setFocusedField(null); saveCurrentDraft(); }}
                        rows={5}
                        placeholder="Describe your impact in paragraphs…"
                        style={fieldStyle(`${exp.id}-desc`, { fontSize: 14, lineHeight: 1.55, resize: "vertical" })}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          openImprove("experience", {
                            entryId: exp.id,
                            entryLabel: exp.title ? `${exp.title}${exp.company ? ` at ${exp.company}` : ""}` : exp.company,
                          })
                        }
                        style={{
                          marginTop: 8,
                          padding: 0,
                          border: "none",
                          background: "none",
                          fontFamily: "system-ui",
                          fontSize: 13,
                          fontWeight: 600,
                          color: LI.blue,
                          cursor: "pointer",
                        }}
                      >
                        Improve this role
                      </button>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>

            <div style={{ background: LI.card, borderRadius: 0, marginTop: 8, padding: stackLayout ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <LiSectionHeader
                title="Education"
                addLabel="+ Add school"
                onAdd={() => { addEducation(); saveCurrentDraft(); }}
                onImprove={() => openImprove("education")}
              />
              {draft.education.length === 0 && (
                <p style={{ fontFamily: "system-ui", fontSize: 14, color: LI.muted, margin: "0 0 12px" }}>
                  Add schools and degrees to match your LinkedIn education section.
                </p>
              )}
              {draft.education.map((edu, idx) => (
                <div
                  key={edu.id}
                  style={{
                    marginBottom: idx < draft.education.length - 1 ? 20 : 0,
                    paddingBottom: idx < draft.education.length - 1 ? 20 : 0,
                    borderBottom: idx < draft.education.length - 1 ? `1px solid ${LI.border}` : undefined,
                  }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <CompanyLogo
                      name={edu.school || "School"}
                      website={edu.schoolRef?.website}
                      logoUrl={edu.schoolRef?.logoUrl}
                      size={48}
                      borderRadius={0}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <LinkedInOrgPicker
                            value={edu.school}
                            orgRef={edu.schoolRef}
                            placeholder="School or university"
                            hintLabel="school"
                            showLogo={false}
                            onChange={(name, ref) =>
                              patchDraft((d) => ({
                                ...d,
                                education: d.education.map((row) =>
                                  row.id === edu.id ? { ...row, school: name, schoolRef: ref } : row,
                                ),
                              }))
                            }
                            onBlur={saveCurrentDraft}
                            inputStyle={fieldStyle(`${edu.id}-school`, { fontSize: 15, fontWeight: 600 })}
                          />
                        </div>
                        <LiEntryMenu
                          canMoveUp={idx > 0}
                          canMoveDown={idx < draft.education.length - 1}
                          onMoveUp={() => {
                            patchDraft((d) => ({ ...d, education: reorderEntries(d.education, edu.id, "up") }));
                            saveCurrentDraft();
                          }}
                          onMoveDown={() => {
                            patchDraft((d) => ({ ...d, education: reorderEntries(d.education, edu.id, "down") }));
                            saveCurrentDraft();
                          }}
                          onDelete={() => {
                            patchDraft((d) => ({ ...d, education: d.education.filter((row) => row.id !== edu.id) }));
                            saveCurrentDraft();
                          }}
                        />
                      </div>
                      <input
                        value={edu.degree}
                        onChange={(e) =>
                          patchDraft((d) => ({
                            ...d,
                            education: d.education.map((row) =>
                              row.id === edu.id ? { ...row, degree: e.target.value } : row,
                            ),
                          }))
                        }
                        onBlur={saveCurrentDraft}
                        placeholder="Degree, field of study"
                        style={fieldStyle(`${edu.id}-degree`, { fontSize: 14, marginTop: 4 })}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <input
                          value={edu.from ?? ""}
                          onChange={(e) =>
                            patchDraft((d) => ({
                              ...d,
                              education: d.education.map((row) =>
                                row.id === edu.id ? { ...row, from: e.target.value } : row,
                              ),
                            }))
                          }
                          onBlur={saveCurrentDraft}
                          placeholder="Start year"
                          style={fieldStyle(`${edu.id}-from`, { fontSize: 13, color: LI.muted, width: 90 })}
                        />
                        <span style={{ color: LI.muted, alignSelf: "center" }}>–</span>
                        <input
                          value={edu.to ?? ""}
                          onChange={(e) =>
                            patchDraft((d) => ({
                              ...d,
                              education: d.education.map((row) =>
                                row.id === edu.id ? { ...row, to: e.target.value } : row,
                              ),
                            }))
                          }
                          onBlur={saveCurrentDraft}
                          placeholder="End year"
                          style={fieldStyle(`${edu.id}-to`, { fontSize: 13, color: LI.muted, width: 90 })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: LI.card, borderRadius: 0, marginTop: 8, padding: stackLayout ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <LiSectionHeader title="Skills" onImprove={() => openImprove("skills")} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {draft.skills.map((skill) => (
                  <span key={skill} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "system-ui", fontSize: 14, fontWeight: 600, color: LI.muted, background: "#eef3f8", padding: "6px 10px 6px 14px", borderRadius: 16 }}>
                    {skill}
                    <button
                      type="button"
                      onClick={() => {
                        patchDraft((d) => ({ ...d, skills: d.skills.filter((s) => s !== skill) }));
                        saveCurrentDraft();
                      }}
                      aria-label={`Remove ${skill}`}
                      style={{ background: "none", border: "none", cursor: "pointer", color: LI.muted, fontSize: 16, lineHeight: 1, padding: 0 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Add a skill"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSkill.trim()) {
                      const skill = newSkill.trim();
                      if (!draft.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
                        patchDraft((d) => ({ ...d, skills: [...d.skills, skill] }));
                        saveCurrentDraft();
                      }
                      setNewSkill("");
                    }
                  }}
                  style={{ ...fieldStyle("new-skill", { fontSize: 14, flex: "1 1 160px", border: `1px solid ${LI.border}`, background: "#fff" }) }}
                />
                <ScoutSecondaryBtn
                  type="button"
                  onClick={() => {
                    const skill = newSkill.trim();
                    if (!skill) return;
                    if (!draft.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) {
                      patchDraft((d) => ({ ...d, skills: [...d.skills, skill] }));
                      saveCurrentDraft();
                    }
                    setNewSkill("");
                  }}
                >
                  Add
                </ScoutSecondaryBtn>
              </div>
            </div>

            <div style={{ background: LI.card, borderRadius: 0, marginTop: 8, padding: stackLayout ? 16 : 24, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <h4 style={{ fontFamily: "system-ui", fontSize: 18, fontWeight: 600, margin: 0, color: LI.text }}>Featured</h4>
                <button
                  type="button"
                  onClick={() => {
                    patchDraft((d) => ({
                      ...d,
                      featured: [
                        ...d.featured,
                        { id: newLinkedInEntryId("feat"), label: "Featured link", url: "https://" },
                      ],
                    }));
                    saveCurrentDraft();
                  }}
                  style={{
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 4,
                    border: `1px solid ${LI.border}`,
                    background: LI.card,
                    color: LI.blue,
                    cursor: "pointer",
                  }}
                >
                  + Add link
                </button>
              </div>
              {draft.featured.length === 0 && (
                <p style={{ fontFamily: "system-ui", fontSize: 14, color: LI.muted, margin: 0 }}>
                  Optional — add portfolio links, articles, or media featured on your LinkedIn profile.
                </p>
              )}
              {draft.featured.map((feat) => (
                <div key={feat.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      value={feat.label}
                      onChange={(e) =>
                        patchDraft((d) => ({
                          ...d,
                          featured: d.featured.map((row) =>
                            row.id === feat.id ? { ...row, label: e.target.value } : row,
                          ),
                        }))
                      }
                      onBlur={saveCurrentDraft}
                      placeholder="Label"
                      style={fieldStyle(`${feat.id}-label`, { fontSize: 14, fontWeight: 600 })}
                    />
                    <input
                      value={feat.url}
                      onChange={(e) =>
                        patchDraft((d) => ({
                          ...d,
                          featured: d.featured.map((row) =>
                            row.id === feat.id ? { ...row, url: e.target.value } : row,
                          ),
                        }))
                      }
                      onBlur={saveCurrentDraft}
                      placeholder="https://"
                      style={fieldStyle(`${feat.id}-url`, { fontSize: 13, color: LI.muted, marginTop: 4 })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      patchDraft((d) => ({ ...d, featured: d.featured.filter((row) => row.id !== feat.id) }));
                      saveCurrentDraft();
                    }}
                    style={{ ...entryMenuBtnStyle(false), color: "#b24040", marginTop: 4 }}
                    title="Remove link"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <ScoutBox padding={stackLayout ? 16 : 20} style={{ minWidth: 0, position: stackLayout ? undefined : "sticky", top: 16 }}>
            <h4 style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: color.ink }}>What to update on LinkedIn</h4>
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 16px" }}>Copy each block into LinkedIn after you edit here.</p>
            {experienceScores.length > 0 && (
              <div style={{ marginBottom: 16, padding: 12, border: border.line, background: surface.inset }}>
                <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 700, color: color.ink, margin: "0 0 8px" }}>Experience quality</p>
                {experienceScores.map((entry) => (
                  <div key={entry.entryId} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, fontFamily: "var(--font-ui)", fontSize: 12 }}>
                    <span style={{ color: LI.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.label}</span>
                    <span style={{ fontWeight: 700, color: entry.score < 60 ? "#b24040" : entry.score < 80 ? "#92400e" : LI.blue, flexShrink: 0 }}>{entry.grade}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: stackLayout ? undefined : "calc(100vh - 220px)", overflowY: stackLayout ? undefined : "auto" }}>
              {checklist.map((item) => (
                <div key={item.id} style={{ border: border.line, borderRadius: 0, padding: 12, background: surface.inset }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, fontWeight: 600, color: LI.blue, textTransform: "uppercase", letterSpacing: 0.5 }}>{item.section}</span>
                      <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, margin: "2px 0 0", color: LI.text }}>{item.label}</p>
                      <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: LI.muted, margin: "2px 0 0" }}>{item.linkedInHint}</p>
                    </div>
                    <ScoutSecondaryBtn type="button" onClick={() => void handleCopy(item.id, item.copyText)} active={copiedId === item.id} style={{ flexShrink: 0, fontSize: 12, padding: "6px 12px" }}>
                      {copiedId === item.id ? "Copied" : item.imageUrl ? "Copy URL" : "Copy"}
                    </ScoutSecondaryBtn>
                  </div>
                  {!item.imageUrl && (
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: LI.muted, margin: 0, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {item.copyText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScoutBox>
        </div>
      )}

      <ResumeAnalysisReportDrawer
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        report={fullReport}
        loading={analysisLoading}
        error={analysisLoading ? undefined : analysis?.error && !fullReport.issues.length ? analysis.error : undefined}
        onBeginImprovements={() => {
          setReportOpen(false);
          openImprove(findPriorityLinkedInSection(analysisReport));
        }}
        onRefresh={() => void loadAnalysis(true)}
        aiUnavailable={!!analysis?.error && fullReport.issues.length > 0}
      />
      <ResumeSectionFixDrawer
        open={!!fixSection}
        sectionId={fixSection?.sectionId ?? null}
        entryLabel={fixSection?.entryLabel}
        sectionTitle={fixSection ? LINKEDIN_SECTION_TITLES[fixSection.sectionId] : undefined}
        issues={fixIssues}
        drawerMode="fix"
        suggestions={fixSuggestions}
        suggestionsLoading={fixSuggestionsLoading}
        onApplySuggestion={applyFixSuggestion}
        emptyMessage={
          !fixSuggestionsLoading && fixSuggestions.length === 0
            ? "No rewrites yet — edit the field in the editor, or try Improve again when AI is available."
            : undefined
        }
        onClose={() => {
          setFixSection(null);
          setFixSuggestions([]);
          setFixSuggestIssues([]);
        }}
      />
    </div>
  );
}

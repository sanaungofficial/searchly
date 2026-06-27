"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type CareerStrategyDocument,
  EMPTY_STRATEGY,
  normalizeStrategyDocument,
  type IntakeParseResult,
  type StrategyProfileFields,
  type StrategyVersion,
} from "@/lib/career-strategy";
import { mergeIntakeTrackedCompanies } from "@/lib/intake-tracked-companies";
import { profileAboutSectionUrl, profileTargetCompaniesUrl, withClientUserId, withClientReviewPagePath } from "@/lib/workspace-urls";
import { CareerPreferencesPanel } from "./career-preferences-panel";
import { openStrategyPdf } from "@/lib/career-strategy-pdf";
import { notifyCreditsChanged } from "@/lib/credits";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";
import { GrowthUpgradeModal } from "./growth-upgrade-modal";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { StrategyFormattedView } from "./strategy-formatted-view";
import { UserAssetsList, type UserAssetListItem } from "./user-assets-list";
import { UploadDocumentModal } from "./upload-document-modal";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

type TrackedCompanyRow = {
  id: string;
  name: string;
  priority: string | null;
  notes: string | null;
  candidateEdge: string | null;
};

export type CareerStrategyProfile = {
  name: string;
  headline: string | null;
  targetRoles: string[];
  targetSalary: string | null;
  currentSalary: string | null;
  employmentStatus: string | null;
  jobTimeline: string | null;
  careerMotivation: string | null;
  priorities: string[];
  targetMarket: string | null;
  relocationOpenness: string | null;
  workAuthorization: string | null;
  securityClearance: string | null;
  searchDuration: string | null;
  positioningStatement: string | null;
  parsedData: { location?: string | null } | null;
  resumeUrl: string | null;
};

type Props = {
  profile: CareerStrategyProfile;
  onPatchProfile: (patch: Record<string, unknown>) => Promise<void>;
  isMobile?: boolean;
  isAdmin?: boolean;
  clientUserId?: string;
};

type StrategyFileAsset = UserAssetListItem;

const STRATEGY_FILE_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const navLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: color.forest,
  textDecoration: "underline",
  cursor: "pointer",
  fontFamily: fontSans,
  fontSize: 12,
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  headline: "Headline",
  summary: "Summary",
  linkedinUrl: "LinkedIn URL",
  targetRoles: "Target roles",
  targetSalary: "Target salary",
  currentSalary: "Current salary",
  employmentStatus: "Employment status",
  jobTimeline: "Job timeline",
  careerMotivation: "Motivation",
  priorities: "Priorities",
  targetMarket: "Target market",
  relocationOpenness: "Relocation",
  workAuthorization: "Work authorization",
  securityClearance: "Security clearance",
  searchDuration: "Search duration",
  positioningStatement: "Positioning statement",
};

const INTAKE_CONTEXT_LABELS: Record<string, string> = {
  recentEmployer: "Recent employer",
  recentTitle: "Recent title",
  industries: "Industries",
  companyStages: "Company stage",
  avoidNotes: "Avoid / pass",
  searchActivity: "Search activity",
  activeOffers: "Active offers",
  benefitsMustHaves: "Benefits must-haves",
  dealBreakers: "Deal breakers",
};

function formatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function timelineLabel(v: string | null): string {
  if (v === "asap") return "Immediate";
  if (v === "3-6mo") return "3–6 months";
  if (v === "open") return "Open / flexible";
  return v ?? "—";
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 100,
  padding: "10px 12px",
  border: border.line,
  borderRadius: "var(--scout-radius)",
  fontFamily: fontSans,
  fontSize: 14,
  lineHeight: 1.5,
  color: color.forest,
  background: surface.inset,
  resize: "vertical",
  boxSizing: "border-box",
};

type StrategyGenerationStatus = "running" | "complete" | "failed" | null;

const POLL_MS = 4000;

function applyStrategyPayload(
  data: Record<string, unknown>,
  setters: {
    setDocument: (d: CareerStrategyDocument) => void;
    setIntakeNotes: (v: string) => void;
    setUpdatedAt: (v: string | null) => void;
    setProfileChanges: (v: string[]) => void;
    setIsStale: (v: boolean) => void;
    setIsPartial: (v: boolean) => void;
    setPartialWarning: (v: string | null) => void;
    setHistory: (v: StrategyVersion[]) => void;
    setSelectedVersionId: (v: "current" | string) => void;
    setGenerationStatus: (v: StrategyGenerationStatus) => void;
    setGenerationError: (v: string | null) => void;
  },
) {
  if (data.document) {
    setters.setDocument(normalizeStrategyDocument(data.document));
    setters.setSelectedVersionId("current");
  } else if (data.hasDocument === false) {
    setters.setDocument(EMPTY_STRATEGY);
  }
  if (data.intakeNotes != null) setters.setIntakeNotes(String(data.intakeNotes));
  if (data.updatedAt != null) setters.setUpdatedAt(data.updatedAt ? String(data.updatedAt) : null);
  setters.setProfileChanges((data.profileChanges as string[]) ?? []);
  setters.setIsStale(!!data.isStale);
  setters.setIsPartial(!!data.isPartial);
  if (data.warning) setters.setPartialWarning(String(data.warning));
  setters.setHistory((data.history as StrategyVersion[]) ?? []);
  setters.setGenerationStatus((data.generationStatus as StrategyGenerationStatus) ?? null);
  setters.setGenerationError(data.generationError ? String(data.generationError) : null);
}

export function CareerStrategyPanel({ profile, onPatchProfile, isMobile, isAdmin = false, clientUserId }: Props) {
  const api = (path: string) => withClientUserId(path, clientUserId);
  const reviewPath = (path: string) => withClientReviewPagePath(path, clientUserId);
  const router = useRouter();
  const [intakeNotes, setIntakeNotes] = useState("");
  const [document, setDocument] = useState<CareerStrategyDocument>(EMPTY_STRATEGY);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseResult, setParseResult] = useState<IntakeParseResult | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [profileChanges, setProfileChanges] = useState<string[]>([]);
  const [isStale, setIsStale] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPartial, setIsPartial] = useState(false);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<TrackedCompanyRow[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [history, setHistory] = useState<StrategyVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<"current" | string>("current");
  const [generationStatus, setGenerationStatus] = useState<StrategyGenerationStatus>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showCompleteBanner, setShowCompleteBanner] = useState(false);
  const [uploadedStrategyFiles, setUploadedStrategyFiles] = useState<StrategyFileAsset[]>([]);
  const [strategyFileUploading, setStrategyFileUploading] = useState(false);
  const [showStrategyUploadModal, setShowStrategyUploadModal] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const generationStatusRef = useRef<StrategyGenerationStatus>(null);

  const isGenerating = generationStatus === "running";

  useEffect(() => {
    generationStatusRef.current = generationStatus;
  }, [generationStatus]);

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    applyStrategyPayload(data, {
      setDocument,
      setIntakeNotes,
      setUpdatedAt,
      setProfileChanges,
      setIsStale,
      setIsPartial,
      setPartialWarning,
      setHistory,
      setSelectedVersionId,
      setGenerationStatus,
      setGenerationError,
    });
  }, []);

  const refreshStrategy = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(api("/api/ai/career-strategy"));
      const data = await readResponseJson(res);
      if (data.error && res.status !== 404) {
        setError(formatApiErrorMessage(data.error));
      } else {
        const prevStatus = generationStatusRef.current;
        applyPayload(data);
        const nextStatus = (data.generationStatus as StrategyGenerationStatus) ?? null;
        if (prevStatus === "running" && nextStatus === "complete") {
          setShowCompleteBanner(true);
        }
        if (nextStatus === "failed" && data.generationError) {
          setError(String(data.generationError));
        }
      }
    } catch (e) {
      if (!options?.silent) {
        setError(formatApiErrorMessage(e, "Failed to load strategy"));
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [applyPayload]);

  const loadStrategy = useCallback(async () => {
    await refreshStrategy();
  }, [refreshStrategy]);

  const refreshStrategyAssets = useCallback(() => {
    fetch(api("/api/assets"))
      .then((r) => r.json())
      .then((assets: Array<{ id: string; name: string; url: string; createdAt: string; type: string }>) => {
        if (!Array.isArray(assets)) return;
        setUploadedStrategyFiles(
          assets
            .filter((a) => a.type === "JOB_SEARCH_STRATEGY")
            .map((a) => ({
              id: a.id,
              type: "JOB_SEARCH_STRATEGY" as const,
              name: a.name,
              url: a.url,
              createdAt: a.createdAt,
            })),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStrategy();
    fetch(api("/api/companies"))
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setCompanies(d);
        else if (d.companies) setCompanies(d.companies);
      })
      .catch(() => {});
    refreshStrategyAssets();
  }, [loadStrategy, refreshStrategyAssets]);

  useEffect(() => {
    if (generationStatus !== "running") return;
    const id = window.setInterval(() => {
      void refreshStrategy({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [generationStatus, refreshStrategy]);

  useEffect(() => {
    if (!showCompleteBanner) return;
    const id = window.setTimeout(() => setShowCompleteBanner(false), 12000);
    return () => window.clearTimeout(id);
  }, [showCompleteBanner]);

  async function saveIntakeNotes() {
    const res = await fetch(api("/api/ai/career-strategy"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeNotes: intakeNotes.trim() }),
    });
    const data = await readResponseJson(res);
    if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Failed to save intake notes"));
  }

  async function handleGenerate() {
    if (!profile.resumeUrl) {
      setError("Upload a resume on the Resumes tab first.");
      return;
    }
    if (isGenerating) return;
    setError(null);
    setPartialWarning(null);
    setShowCompleteBanner(false);
    try {
      if (intakeNotes.trim()) {
        await saveIntakeNotes();
      }
      const res = await fetch(api("/api/ai/career-strategy"), { method: "POST" });
      const data = await readResponseJson(res);
      if (res.status === 402) {
        notifyCreditsChanged();
        setShowUpgrade(true);
        return;
      }
      if (!res.ok && res.status !== 202) {
        throw new Error(formatApiErrorMessage(data.error, "Generation failed"));
      }
      setGenerationStatus("running");
      setGenerationError(null);
      notifyCreditsChanged();
      if (res.status === 202) return;
      applyPayload(data);
      if (data.warning) setPartialWarning(String(data.warning));
    } catch (e) {
      setError(formatApiErrorMessage(e, "Generation failed"));
    }
  }

  async function handleSaveDocument() {
    setSaving(true);
    try {
      const res = await fetch(api("/api/ai/career-strategy"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document, intakeNotes }),
      });
      if (!res.ok) throw new Error("Save failed");
      setUpdatedAt(new Date().toISOString());
      setEditMode(false);
    } catch {
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleParseIntake() {
    if (!intakeNotes.trim()) {
      setError("Paste client intake notes first.");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      await saveIntakeNotes();
      const res = await fetch(api("/api/ai/strategy-intake"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: intakeNotes }),
      });
      const data = await readResponseJson(res);
      if (res.status === 402) {
        notifyCreditsChanged();
        setShowUpgrade(true);
        return;
      }
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Parse failed"));
      setParseResult(data as IntakeParseResult);
      setShowApplyModal(true);
      notifyCreditsChanged();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Parse failed"));
    } finally {
      setParsing(false);
    }
  }

  async function applyParsedFields() {
    if (!parseResult) return;
    setError(null);
    try {
      const patch: Record<string, unknown> = { ...(parseResult.proposed ?? {}) };
      if (Object.keys(patch).length > 0) {
        if (patch.name) {
          await onPatchProfile({ name: patch.name });
          delete patch.name;
        }
        if (Object.keys(patch).length > 0) {
          await onPatchProfile(patch);
        }
      }

      const trackedCompanies = mergeIntakeTrackedCompanies(parseResult);
      let companyMessage = "";
      if (trackedCompanies.length > 0) {
        const res = await fetch(api("/api/companies/intake-apply"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestedTrackedCompanies: trackedCompanies }),
        });
        const data = await readResponseJson(res);
        if (!res.ok) {
          throw new Error(formatApiErrorMessage(data.error, "Failed to add target companies"));
        }
        const added = Number(data.added ?? 0);
        const updated = Number(data.updated ?? 0);
        const skipped = Number(data.skipped ?? 0);
        const errors = Array.isArray(data.errors) ? data.errors.length : 0;
        companyMessage = `Target companies: ${added} added, ${updated} updated${skipped ? `, ${skipped} unchanged` : ""}${errors ? `, ${errors} failed` : ""}.`;
      }

      setShowApplyModal(false);
      setParseResult(null);
      if (companyMessage) {
        setApplySuccess(companyMessage);
        window.setTimeout(() => setApplySuccess(null), 12000);
      }
      await loadStrategy();
      if (trackedCompanies.length > 0) {
        fetch(api("/api/companies"))
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d)) setCompanies(d);
            else if (d.companies) setCompanies(d.companies);
          })
          .catch(() => {});
      }
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to apply profile updates"));
    }
  }

  const hasDocument = !!(updatedAt && document.executiveSummary);

  const viewingDocument: CareerStrategyDocument | null =
    selectedVersionId === "current"
      ? hasDocument
        ? document
        : null
      : history.find((h) => h.id === selectedVersionId)?.document ?? null;

  const viewingUpdatedAt =
    selectedVersionId === "current"
      ? updatedAt
      : history.find((h) => h.id === selectedVersionId)?.savedAt ?? null;

  const hasViewableDocument = !!(viewingDocument && viewingDocument.executiveSummary?.trim());

  function buildSearchPreferencesSummary() {
    return [
      { label: "Current location", value: profile.parsedData?.location ?? "—" },
      { label: "Target market", value: profile.targetMarket ?? "—" },
      { label: "Target salary", value: profile.targetSalary ?? "—" },
      { label: "Work arrangement", value: (profile.priorities ?? []).filter((p) => p.includes("Remote") || p.includes("Hybrid")).join(", ") || "—" },
      { label: "Relocation", value: profile.relocationOpenness ?? "—" },
      { label: "Target start", value: timelineLabel(profile.jobTimeline) },
      { label: "Work authorization", value: profile.workAuthorization ?? "—" },
      { label: "Security clearance", value: profile.securityClearance ?? "—" },
      { label: "Search duration", value: profile.searchDuration ?? "—" },
    ];
  }

  async function handleStrategyFileUpload(file: File) {
    setStrategyFileUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", "JOB_SEARCH_STRATEGY");
      const res = await fetch(api("/api/assets/upload"), { method: "POST", body: form });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(formatApiErrorMessage(data.error, "Upload failed"));
      refreshStrategyAssets();
    } catch (e) {
      setError(formatApiErrorMessage(e, "Failed to upload strategy file"));
      throw e;
    } finally {
      setStrategyFileUploading(false);
    }
  }

  async function handleStrategyFilesSelected(files: File[]) {
    if (!files.length) return;
    for (const file of files) {
      try {
        await handleStrategyFileUpload(file);
      } catch {
        return;
      }
    }
    setShowStrategyUploadModal(false);
  }

  async function handleRemoveStrategyFile(id: string) {
    try {
      const res = await fetch(api(`/api/assets?id=${encodeURIComponent(id)}`), { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      refreshStrategyAssets();
    } catch {
      setError("Failed to remove strategy file");
    }
  }

  function handleDownloadPdf(forDocument?: CareerStrategyDocument, forUpdatedAt?: string | null) {
    const doc = forDocument ?? viewingDocument;
    const at = forUpdatedAt ?? (selectedVersionId === "current" ? updatedAt : history.find((h) => h.id === selectedVersionId)?.savedAt ?? updatedAt);
    if (!doc) return;

    openStrategyPdf({
      candidateName: profile.name,
      headline: profile.headline,
      preparedAt: at
        ? new Date(at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
        : new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      targetPlacementWindow: timelineLabel(profile.jobTimeline),
      keyParameters: buildSearchPreferencesSummary(),
      trackedCompanies: companies.map((c) => ({
        name: c.name,
        priority: c.priority,
        notes: c.notes ?? c.candidateEdge,
      })),
      targetRoles: profile.targetRoles,
      document: doc,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {isPartial && (
        <ScoutBox padding={16} style={{ background: "rgba(200, 120, 40, 0.08)", borderColor: "rgba(200, 120, 40, 0.35)" }}>
          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, margin: "0 0 6px" }}>
            Partial strategy saved
          </p>
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>
            {partialWarning ??
              "Generation was cut short. Review the sections below — regenerate only when you want the full document (uses 1 credit)."}
          </p>
          <ScoutSecondaryBtn onClick={handleGenerate} disabled={isGenerating || !isAdmin}>
            {isGenerating ? "Regenerating…" : "Regenerate full strategy"}
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      {isStale && profileChanges.length > 0 && (
        <ScoutBox padding={16} style={{ background: "rgba(200, 120, 40, 0.08)", borderColor: "rgba(200, 120, 40, 0.35)" }}>
          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, margin: "0 0 6px" }}>
            Profile updated since this strategy was generated
          </p>
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>
            Changes: {profileChanges.join(", ")}. Regenerate only if these updates should change the strategy.
          </p>
          <ScoutSecondaryBtn onClick={handleGenerate} disabled={isGenerating || !isAdmin}>
            {isGenerating ? "Regenerating…" : "Regenerate strategy"}
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      {isAdmin && (
        <ScoutBox padding={isMobile ? 16 : 22}>
          <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
            Client intake notes
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: color.forest, textTransform: "none", letterSpacing: 0 }}>Admin only</span>
          </p>
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>
            Paste onboarding answers, target company lists, or external strategy docs. Parse to update profile fields and target companies, then generate a Kimchi strategy draft.
          </p>
          <textarea
            value={intakeNotes}
            onChange={(e) => setIntakeNotes(e.target.value)}
            placeholder="Paste client intake responses here…"
            style={{ ...textareaStyle, minHeight: 140 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <ScoutSecondaryBtn onClick={handleParseIntake} disabled={parsing || isGenerating || !intakeNotes.trim()}>
              {parsing ? "Parsing…" : "Parse & review profile updates"}
            </ScoutSecondaryBtn>
            <ScoutPrimaryBtn onClick={handleGenerate} disabled={isGenerating || parsing}>
              {isGenerating ? "Generating…" : hasDocument ? "Regenerate Kimchi strategy" : "Generate Kimchi strategy"}
            </ScoutPrimaryBtn>
          </div>
          {parsing && (
            <div style={{ marginTop: 16 }}>
              <KimchiProcessLoader preset="strategyIntake" variant="inline" />
            </div>
          )}
          {isGenerating && (
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "12px 0 0" }}>
              Generation runs in the background — you can leave this page and come back anytime.
            </p>
          )}
          <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "10px 0 0" }}>
            Kimchi strategy generation uses 1 AI credit.
          </p>
        </ScoutBox>
      )}

      {applySuccess && (
        <ScoutBox padding={16} style={{ background: "rgba(74,139,106,0.08)", borderColor: "rgba(74,139,106,0.35)" }}>
          <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, margin: 0 }}>{applySuccess}</p>
        </ScoutBox>
      )}

      {error && (
        <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b04040", margin: 0 }}>{error}</p>
      )}

      <CareerPreferencesPanel
        profile={profile}
        onSave={onPatchProfile}
        title="Search preferences"
        subtitle="Salary, timeline, location targets, and priorities — these shape role matching and your strategy document."
        locationEditHref={profileAboutSectionUrl("personal")}
      />

      <ScoutBox padding={isMobile ? 16 : 22}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div>
            <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Target roles
            </p>
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "6px 0 0" }}>
              Synced from your Target Roles tab
            </p>
          </div>
          <button type="button" onClick={() => router.push(reviewPath("/profile/dream-role"))} style={navLinkStyle}>
            Edit target roles →
          </button>
        </div>
        {profile.targetRoles.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>
            No target roles yet.{" "}
            <button type="button" onClick={() => router.push(reviewPath("/profile/dream-role"))} style={{ ...navLinkStyle, fontSize: 13 }}>
              Add roles →
            </button>
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {profile.targetRoles.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => router.push(reviewPath("/profile/dream-role"))}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--scout-radius)",
                  border: border.line,
                  background: surface.inset,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  color: color.forest,
                  cursor: "pointer",
                }}
              >
                {role}
              </button>
            ))}
          </div>
        )}
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div>
            <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Target companies
            </p>
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "6px 0 0" }}>
              Synced from your Target Companies watchlist
            </p>
          </div>
          <button type="button" onClick={() => router.push(reviewPath("/profile/target-companies"))} style={navLinkStyle}>
            Manage companies →
          </button>
        </div>
        {companies.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>
            No companies tracked yet.{" "}
            <button type="button" onClick={() => router.push(reviewPath("/profile/target-companies"))} style={{ ...navLinkStyle, fontSize: 13 }}>
              Add companies →
            </button>
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: border.line }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: color.muted, fontWeight: 600 }}>Company</th>
                <th style={{ textAlign: "left", padding: "6px 8px", color: color.muted, fontWeight: 600 }}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {companies.slice(0, 12).map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: border.line, cursor: "pointer" }}
                  onClick={() => router.push(profileTargetCompaniesUrl(c.id))}
                >
                  <td style={{ padding: "8px", color: color.forest, textDecoration: "underline" }}>{c.name}</td>
                  <td style={{ padding: "8px", color: color.muted }}>{c.priority ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScoutBox>

      {/* Strategy document */}
      <ScoutBox padding={isMobile ? 16 : 22}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <div>
            <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: color.forest, margin: 0 }}>
              Career strategy document
            </p>
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "6px 0 0", maxWidth: 520, lineHeight: 1.5 }}>
              Upload PDF or Word strategy documents — stored in your file library alongside resumes. Add as many as you need.
            </p>
          </div>
        </div>

        <UserAssetsList
          assets={uploadedStrategyFiles}
          types={["JOB_SEARCH_STRATEGY"]}
          compact
          isMobile={isMobile}
          emptyMessage="No strategy documents uploaded yet."
          uploadLabel="+ Add strategy document"
          uploading={strategyFileUploading}
          onUpload={() => setShowStrategyUploadModal(true)}
          onDelete={(id) => void handleRemoveStrategyFile(id)}
        />

        <UploadDocumentModal
          open={showStrategyUploadModal}
          onClose={() => {
            if (!strategyFileUploading) setShowStrategyUploadModal(false);
          }}
          onFilesSelected={(files) => void handleStrategyFilesSelected(files)}
          uploading={strategyFileUploading}
          accept={STRATEGY_FILE_ACCEPT}
          multiple
          label="Strategy document"
          title="Upload a strategy document"
          hint="PDF or Word format · max 10MB · add multiple files if needed"
          dropHint="Drop strategy documents here"
        />

        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "12px 0 0" }}>
          All files live in Profile → Resumes under your shared document library, tagged by type.
        </p>

        {(hasDocument || history.length > 0 || isGenerating) && (
          <>
            <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
              Kimchi-generated strategy
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {viewingUpdatedAt && (
                <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>
                  {selectedVersionId === "current" ? "Current version · " : "Previous version · "}
                  {new Date(viewingUpdatedAt).toLocaleString()}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
                {(hasDocument || history.length > 0) && (
                  <select
                    value={selectedVersionId}
                    onChange={(e) => {
                      setSelectedVersionId(e.target.value);
                      setEditMode(false);
                    }}
                    style={{
                      fontFamily: fontSans,
                      fontSize: 13,
                      padding: "6px 10px",
                      border: border.line,
                      background: surface.inset,
                      color: color.forest,
                    }}
                  >
                    {hasDocument && (
                      <option value="current">
                        Current{updatedAt ? ` (${new Date(updatedAt).toLocaleDateString()})` : ""}
                      </option>
                    )}
                    {history.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.label ?? "Previous"} ({new Date(h.savedAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                )}
                {hasViewableDocument && selectedVersionId === "current" && (
                  <>
                    <ScoutSecondaryBtn onClick={() => setEditMode(!editMode)}>
                      {editMode ? "Preview" : "Edit"}
                    </ScoutSecondaryBtn>
                    {editMode && (
                      <ScoutPrimaryBtn onClick={handleSaveDocument} disabled={saving}>
                        {saving ? "Saving…" : "Save edits"}
                      </ScoutPrimaryBtn>
                    )}
                  </>
                )}
                {hasViewableDocument && (
                  <ScoutSecondaryBtn onClick={() => handleDownloadPdf()} disabled={!hasViewableDocument}>
                    Download PDF
                  </ScoutSecondaryBtn>
                )}
              </div>
            </div>
          </>
        )}

        {isGenerating && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              background: "rgba(26, 58, 47, 0.06)",
              border: border.line,
              fontFamily: fontSans,
              fontSize: 13,
              color: color.forest,
            }}
          >
            <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Your strategy is being written</p>
            <p style={{ margin: 0, color: color.muted, lineHeight: 1.5 }}>
              Usually takes 1–3 minutes. You can navigate away — we&apos;ll keep working in the background.
              {hasViewableDocument
                ? ` Showing ${selectedVersionId === "current" ? "current" : "selected"} document until the new version is ready.`
                : ""}
            </p>
            <div style={{ marginTop: 12 }}>
              <KimchiProcessLoader preset="careerStrategy" variant="inline" />
            </div>
          </div>
        )}

        {showCompleteBanner && generationStatus === "complete" && !isGenerating && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              background: "rgba(74, 139, 106, 0.1)",
              border: "1px solid rgba(74, 139, 106, 0.35)",
              fontFamily: fontSans,
              fontSize: 13,
              color: color.forest,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>Strategy ready</p>
            <p style={{ margin: "6px 0 0", color: color.muted }}>
              Your career strategy document has finished generating.
            </p>
          </div>
        )}

        {generationStatus === "failed" && generationError && !isGenerating && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 14px",
              background: "rgba(176, 64, 64, 0.08)",
              border: "1px solid rgba(176, 64, 64, 0.25)",
              fontFamily: fontSans,
              fontSize: 13,
              color: "#8b3030",
            }}
          >
            <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Generation failed</p>
            <p style={{ margin: 0 }}>{generationError}</p>
          </div>
        )}

        {loading ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>Loading…</p>
        ) : !hasViewableDocument && !isGenerating && uploadedStrategyFiles.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>
            Upload a strategy file above{isAdmin ? ", or use client intake notes to generate one with Kimchi" : ""}.
          </p>
        ) : !hasViewableDocument && isGenerating ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>
            First strategy generating… check back in a minute or two.
          </p>
        ) : editMode && selectedVersionId === "current" ? (
          <StrategyEditor document={document} onChange={setDocument} />
        ) : viewingDocument ? (
          <StrategyFormattedView
            candidateName={profile.name}
            headline={profile.headline}
            preparedAt={
              viewingUpdatedAt
                ? new Date(viewingUpdatedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
                : new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
            }
            targetPlacementWindow={timelineLabel(profile.jobTimeline)}
            keyParameters={buildSearchPreferencesSummary()}
            trackedCompanies={companies.map((c) => ({
              name: c.name,
              priority: c.priority,
              notes: c.notes ?? c.candidateEdge,
            }))}
            targetRoles={profile.targetRoles}
            document={viewingDocument}
            isMobile={isMobile}
          />
        ) : null}
      </ScoutBox>

      {showApplyModal && parseResult && (
        <ApplyProfileModal
          result={parseResult}
          onClose={() => setShowApplyModal(false)}
          onApply={applyParsedFields}
        />
      )}

      {showUpgrade && <GrowthUpgradeModal trigger="limit_hit" onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}

function StrategyEditor({
  document: d,
  onChange,
}: {
  document: CareerStrategyDocument;
  onChange: (d: CareerStrategyDocument) => void;
}) {
  const update = (partial: Partial<CareerStrategyDocument>) => onChange({ ...d, ...partial });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Executive Summary</label>
      <textarea style={textareaStyle} value={d.executiveSummary} onChange={(e) => update({ executiveSummary: e.target.value })} />
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Core Positioning Directive</label>
      <textarea style={textareaStyle} value={d.positioningStrategy.coreDirective} onChange={(e) => update({ positioningStrategy: { ...d.positioningStrategy, coreDirective: e.target.value } })} />
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Positioning Statement</label>
      <textarea style={{ ...textareaStyle, minHeight: 120 }} value={d.positioningStrategy.positioningStatement} onChange={(e) => update({ positioningStrategy: { ...d.positioningStrategy, positioningStatement: e.target.value } })} />
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Path Forward Summary</label>
      <textarea style={textareaStyle} value={d.pathForward.summary} onChange={(e) => update({ pathForward: { ...d.pathForward, summary: e.target.value } })} />
      <label style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>Closing</label>
      <textarea style={textareaStyle} value={d.pathForward.closing} onChange={(e) => update({ pathForward: { ...d.pathForward, closing: e.target.value } })} />
    </div>
  );
}

function ApplyProfileModal({
  result,
  onClose,
  onApply,
}: {
  result: IntakeParseResult;
  onClose: () => void;
  onApply: () => void;
}) {
  const entries = Object.entries(result.proposed).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0));
  const contextEntries = Object.entries(result.intakeContext ?? {}).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  );
  const trackedCompanies = mergeIntakeTrackedCompanies(result);
  const canApply = entries.length > 0 || trackedCompanies.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#FFFDF9", maxWidth: 560, width: "100%", maxHeight: "80vh", overflow: "auto", padding: 24, border: border.lineStrong }}>
        <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 8px", color: color.forest }}>Review profile updates</h3>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 16px" }}>{result.summary}</p>
        {entries.length === 0 && contextEntries.length === 0 && trackedCompanies.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 14 }}>No structured fields found. Try adding more detail to the intake notes.</p>
        ) : (
          <>
            {entries.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13, marginBottom: 16 }}>
                <tbody>
                  {entries.map(([key, val]) => (
                    <tr key={key} style={{ borderBottom: border.line }}>
                      <td style={{ padding: "8px 8px 8px 0", color: color.muted, verticalAlign: "top", width: "40%" }}>{FIELD_LABELS[key] ?? key}</td>
                      <td style={{ padding: "8px 0", color: color.forest }}>{formatValue(val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {contextEntries.length > 0 && (
              <>
                <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                  Also captured for strategy (from intake notes)
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13, marginBottom: 16 }}>
                  <tbody>
                    {contextEntries.map(([key, val]) => (
                      <tr key={key} style={{ borderBottom: border.line }}>
                        <td style={{ padding: "8px 8px 8px 0", color: color.muted, verticalAlign: "top", width: "40%" }}>{INTAKE_CONTEXT_LABELS[key] ?? key}</td>
                        <td style={{ padding: "8px 0", color: color.forest }}>{formatValue(val)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {trackedCompanies.length > 0 && (
              <>
                <p style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, margin: "0 0 8px" }}>
                  <strong>{trackedCompanies.length} target companies</strong> will be added or updated on apply.
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: fontSans, fontSize: 13, marginBottom: 16 }}>
                  <thead>
                    <tr style={{ borderBottom: border.line }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: color.muted, fontWeight: 600 }}>Company</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: color.muted, fontWeight: 600 }}>Priority</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: color.muted, fontWeight: 600 }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackedCompanies.slice(0, 12).map((c) => (
                      <tr key={c.name} style={{ borderBottom: border.line }}>
                        <td style={{ padding: "8px", verticalAlign: "top" }}>{c.name}</td>
                        <td style={{ padding: "8px", color: color.muted, verticalAlign: "top" }}>{c.priority ?? "—"}</td>
                        <td style={{ padding: "8px", color: color.muted, verticalAlign: "top" }}>
                          {c.notes ?? c.candidateEdge ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trackedCompanies.length > 12 && (
                  <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 16px" }}>
                    +{trackedCompanies.length - 12} more companies
                  </p>
                )}
              </>
            )}
          </>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <ScoutSecondaryBtn onClick={onClose}>Cancel</ScoutSecondaryBtn>
          <ScoutPrimaryBtn onClick={onApply} disabled={!canApply}>Apply to profile</ScoutPrimaryBtn>
        </div>
      </div>
    </div>
  );
}

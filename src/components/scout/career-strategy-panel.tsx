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
import { openStrategyPdf } from "@/lib/career-strategy-pdf";
import { notifyCreditsChanged } from "@/lib/credits";
import { formatApiErrorMessage, readResponseJson } from "@/lib/api-error-message";
import { GrowthUpgradeModal } from "./growth-upgrade-modal";
import { KimchiProcessLoader } from "./kimchi-process-loader";
import { StrategyFormattedView } from "./strategy-formatted-view";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { border, color, fontSans, surface, T } from "@/lib/typography";

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
  borderRadius: 0,
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

export function CareerStrategyPanel({ profile, onPatchProfile, isMobile }: Props) {
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
      const res = await fetch("/api/ai/career-strategy");
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

  useEffect(() => {
    loadStrategy();
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setCompanies(d);
        else if (d.companies) setCompanies(d.companies);
      })
      .catch(() => {});
  }, [loadStrategy]);

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
    const res = await fetch("/api/ai/career-strategy", {
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
      const res = await fetch("/api/ai/career-strategy", { method: "POST" });
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
      const res = await fetch("/api/ai/career-strategy", {
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
      const res = await fetch("/api/ai/strategy-intake", {
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
    if (!parseResult?.proposed) return;
    const patch: Record<string, unknown> = { ...parseResult.proposed };
    if (patch.name) {
      await onPatchProfile({ name: patch.name });
      delete patch.name;
    }
    await onPatchProfile(patch);

    const dreamCompanies = parseResult.suggestedDreamCompanies ?? [];
    if (dreamCompanies.length > 0) {
      await Promise.all(
        dreamCompanies.slice(0, 20).map((name) =>
          fetch("/api/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), priority: "high" }),
          }).catch(() => null),
        ),
      );
    }

    setShowApplyModal(false);
    setParseResult(null);
    await loadStrategy();
    if (dreamCompanies.length > 0) {
      fetch("/api/companies")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setCompanies(d);
          else if (d.companies) setCompanies(d.companies);
        })
        .catch(() => {});
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

  function buildKeyParameters() {
    return [
      { label: "Current Location", value: profile.parsedData?.location ?? "—" },
      { label: "Target Market", value: profile.targetMarket ?? "—" },
      { label: "Target Base Salary", value: profile.targetSalary ?? "—" },
      { label: "Work Arrangement", value: (profile.priorities ?? []).filter((p) => p.includes("Remote") || p.includes("Hybrid")).join(", ") || "—" },
      { label: "Relocation", value: profile.relocationOpenness ?? "—" },
      { label: "Target Start", value: timelineLabel(profile.jobTimeline) },
      { label: "Target Roles", value: profile.targetRoles.join(", ") || "—" },
      { label: "Security Clearance", value: profile.securityClearance ?? "—" },
      { label: "Work Authorization", value: profile.workAuthorization ?? "—" },
      { label: "Search Duration", value: profile.searchDuration ?? "—" },
    ];
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
      keyParameters: buildKeyParameters(),
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
          <ScoutSecondaryBtn onClick={handleGenerate} disabled={isGenerating}>
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
          <ScoutSecondaryBtn onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? "Regenerating…" : "Regenerate strategy"}
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      <ScoutBox padding={isMobile ? 16 : 22}>
        <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
          Client intake notes
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 10px" }}>
          Paste answers from your external intake form. Parse to update profile fields (with your approval), then generate the strategy doc.
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 10px" }}>
          Full onboarding forms are supported — paste everything. Credentials and passwords are ignored and never stored.
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
            {isGenerating ? "Generating…" : hasDocument ? "Regenerate strategy" : "Generate strategy"}
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
          Strategy generation uses 1 AI credit and only runs when you click the button above.
        </p>
        {error && (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: "#b04040", marginTop: 10 }}>{error}</p>
        )}
      </ScoutBox>

      {/* Compiled from profile — not duplicated */}
      <ScoutBox padding={isMobile ? 16 : 22}>
        <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
          Key parameters (from profile)
        </p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "8px 24px", fontFamily: fontSans, fontSize: 13 }}>
          {[
            ["Location", profile.parsedData?.location],
            ["Target market", profile.targetMarket],
            ["Target salary", profile.targetSalary],
            ["Timeline", timelineLabel(profile.jobTimeline)],
            ["Relocation", profile.relocationOpenness],
            ["Clearance", profile.securityClearance],
            ["Work auth", profile.workAuthorization],
            ["Search duration", profile.searchDuration],
          ].map(([label, val]) => (
            <div key={String(label)}>
              <span style={{ color: color.muted }}>{label}: </span>
              <span style={{ color: color.forest }}>{val || "—"}</span>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "12px 0 0" }}>
          <button type="button" onClick={() => router.push("/profile/preferences")} style={{ background: "none", border: "none", padding: 0, color: color.forest, textDecoration: "underline", cursor: "pointer", fontFamily: fontSans, fontSize: 12 }}>
            Edit in Preferences →
          </button>
        </p>
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div>
            <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Target roles (from profile)
            </p>
            <p style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, margin: "6px 0 0" }}>
              {profile.targetRoles.length ? profile.targetRoles.join(" · ") : "None set"}
            </p>
          </div>
          <button type="button" onClick={() => router.push("/profile/dream-role")} style={{ background: "none", border: "none", padding: 0, color: color.forest, textDecoration: "underline", cursor: "pointer", fontFamily: fontSans, fontSize: 12 }}>
            Edit target roles →
          </button>
        </div>
      </ScoutBox>

      <ScoutBox padding={isMobile ? 16 : 22}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <p style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            Target companies (watchlist)
          </p>
          <button type="button" onClick={() => router.push("/profile/target-companies")} style={{ background: "none", border: "none", padding: 0, color: color.forest, textDecoration: "underline", cursor: "pointer", fontFamily: fontSans, fontSize: 12 }}>
            Manage in Target Companies →
          </button>
        </div>
        {companies.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>No companies tracked yet.</p>
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
                <tr key={c.id} style={{ borderBottom: border.line }}>
                  <td style={{ padding: "8px" }}>{c.name}</td>
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
              Career Strategy document
            </p>
            {viewingUpdatedAt && (
              <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "4px 0 0" }}>
                {selectedVersionId === "current" ? "Current version · " : "Previous version · "}
                {new Date(viewingUpdatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
        ) : !hasViewableDocument && !isGenerating ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>
            No strategy yet. Paste intake notes and click Generate strategy.
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
            keyParameters={buildKeyParameters()}
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
  const dreamCompanies = result.suggestedDreamCompanies ?? [];
  const canApply = entries.length > 0 || dreamCompanies.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#FFFDF9", maxWidth: 560, width: "100%", maxHeight: "80vh", overflow: "auto", padding: 24, border: border.lineStrong }}>
        <h3 style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 8px", color: color.forest }}>Review profile updates</h3>
        <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 16px" }}>{result.summary}</p>
        {entries.length === 0 && contextEntries.length === 0 && dreamCompanies.length === 0 ? (
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
            {dreamCompanies.length > 0 && (
              <p style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, margin: "0 0 16px" }}>
                <strong>{dreamCompanies.length} dream companies</strong> will be added to the watchlist on apply:{" "}
                {dreamCompanies.slice(0, 8).join(", ")}
                {dreamCompanies.length > 8 ? ` +${dreamCompanies.length - 8} more` : ""}
              </p>
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
